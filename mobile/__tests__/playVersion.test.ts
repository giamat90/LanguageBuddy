/**
 * TASK-028: release guard (scripts/lib/playVersion.js, scripts/check-play-version.js) and the
 * release workflow wiring. The Play API is mocked; nothing here touches the network.
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateKeyPairSync } from 'crypto';
import { spawnSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usedVersionCodes, assertNewVersionCode, releaseTag, fetchPlayVersionCodes } = require('../scripts/lib/playVersion');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-play-version.js');
const WORKFLOW = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'release-android.yml'), 'utf8');

describe('usedVersionCodes', () => {
  it('merges track releases and uploaded bundles, numbers and strings', () => {
    const tracks = [
      { track: 'internal', releases: [{ versionCodes: ['12', '13'] }] },
      { track: 'production', releases: [{ versionCodes: [10] }, { versionCodes: ['11'] }] },
    ];
    const bundles = [{ versionCode: 14 }, { versionCode: '15' }];
    expect(usedVersionCodes(tracks, bundles)).toEqual([10, 11, 12, 13, 14, 15]);
  });
  it('counts a bundle that is on no track (it still burns its code)', () => {
    expect(usedVersionCodes([], [{ versionCode: 15 }])).toEqual([15]);
  });
  it('ignores junk and tolerates missing fields', () => {
    expect(usedVersionCodes([{ releases: [{}] }, { track: 'x' }, null], [{ versionCode: 'abc' }, {}, null])).toEqual([]);
    expect(usedVersionCodes(undefined, undefined)).toEqual([]);
  });
});

describe('assertNewVersionCode', () => {
  it('accepts a code above the highest used', () => {
    expect(() => assertNewVersionCode(16, [13, 15])).not.toThrow();
    expect(() => assertNewVersionCode('16', [15])).not.toThrow();
  });
  it('rejects an equal or lower code, naming the highest', () => {
    expect(() => assertNewVersionCode(15, [13, 15])).toThrow(/15/);
    expect(() => assertNewVersionCode(3, [13, 15])).toThrow(/highest.*15/i);
  });
  it('rejects anything that is not a positive integer', () => {
    for (const bad of [0, -1, 1.5, 'x', '', NaN, undefined]) {
      expect(() => assertNewVersionCode(bad, [])).toThrow();
    }
  });
  it('accepts any positive integer when Play has nothing yet', () => {
    expect(() => assertNewVersionCode(1, [])).not.toThrow();
  });
});

describe('releaseTag', () => {
  it('prefixes the version name with v', () => {
    expect(releaseTag('1.0.16')).toBe('v1.0.16');
  });
  it('rejects a malformed version', () => {
    expect(() => releaseTag('1.0')).toThrow();
    expect(() => releaseTag('v1.0.16')).toThrow();
    expect(() => releaseTag('')).toThrow();
  });
  it('matches the version app.config.js produces for a given code', () => {
    const prev = process.env.ANDROID_VERSION_CODE;
    process.env.ANDROID_VERSION_CODE = '77';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg = require('../app.config.js');
      expect(releaseTag(cfg.expo.version)).toBe('v1.0.77');
    });
    if (prev === undefined) delete process.env.ANDROID_VERSION_CODE; else process.env.ANDROID_VERSION_CODE = prev;
  });
});

describe('fetchPlayVersionCodes', () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const serviceAccount = { client_email: 'svc@example.iam.gserviceaccount.com', private_key: privateKey };
  const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

  function mockFetch(overrides: Record<string, () => unknown> = {}) {
    const calls: { method: string; url: string }[] = [];
    const fn = jest.fn(async (url: string, init: { method?: string } = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url });
      const key = `${method} ${new URL(url).pathname.replace(/\/edits\/[^/]+/, '/edits/ID')}`;
      if (overrides[key]) return overrides[key]();
      if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'tok_secret_123' });
      if (key === 'POST /androidpublisher/v3/applications/com.x.y/edits') return json({ id: 'e1' });
      if (key.endsWith('/edits/ID/tracks')) return json({ tracks: [{ track: 'internal', releases: [{ versionCodes: ['13'] }] }] });
      if (key.endsWith('/edits/ID/bundles')) return json({ bundles: [{ versionCode: 14 }] });
      if (method === 'DELETE') return json({});
      return json({}, 404);
    });
    return { fn, calls };
  }

  it('reads tracks and bundles, and deletes the edit', async () => {
    const { fn, calls } = mockFetch();
    const used = await fetchPlayVersionCodes({ serviceAccount, packageName: 'com.x.y', fetchImpl: fn });
    expect(used).toEqual([13, 14]);
    expect(calls[calls.length - 1]).toMatchObject({ method: 'DELETE' });
    const tokenCall = fn.mock.calls[0] as unknown as [string, { body: string }];
    expect(tokenCall[1].body).toContain('grant_type=');
  });

  it('still deletes the edit when listing fails, and leaks no secret in the error', async () => {
    const { fn, calls } = mockFetch({
      'GET /androidpublisher/v3/applications/com.x.y/edits/ID/tracks': () => json({ error: 'boom' }, 500),
    });
    const err = await fetchPlayVersionCodes({ serviceAccount, packageName: 'com.x.y', fetchImpl: fn }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toMatch(/tok_secret_123|PRIVATE KEY/);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('fails clearly when the token exchange is refused', async () => {
    const { fn } = mockFetch({ 'POST /token': () => json({ error: 'invalid_grant' }, 400) });
    await expect(fetchPlayVersionCodes({ serviceAccount, packageName: 'com.x.y', fetchImpl: fn })).rejects.toThrow(/token/i);
  });

  it('rejects a service account without a key', async () => {
    await expect(fetchPlayVersionCodes({ serviceAccount: {}, packageName: 'com.x.y', fetchImpl: jest.fn() })).rejects.toThrow();
  });
});

describe('check-play-version CLI', () => {
  const run = (args: string[], env: Record<string, string | undefined> = {}) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '', ...env } });

  it('exit 0 when the requested code is higher (offline --used)', () => {
    const r = run(['16', '--used', '12,13,15']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/highest.*15/i);
  });
  it('exit 1 when the requested code is not higher', () => {
    const r = run(['15', '--used', '12,13,15']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/15/);
  });
  it('exit 2 without credentials and without --used', () => {
    expect(run(['16']).status).toBe(2);
  });
  it('exit 2 on a malformed key and never echoes it', () => {
    const r = run(['16'], { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"private_key":"SUPERSECRET"' });
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toContain('SUPERSECRET');
  });
  it('exit 2 on a non-numeric code', () => {
    expect(run(['abc', '--used', '1']).status).toBe(2);
  });
});

describe('release-android.yml wiring', () => {
  const at = (needle: string) => {
    const i = WORKFLOW.indexOf(needle);
    expect(i).toBeGreaterThan(-1);
    return i;
  };
  it('checks Play before the native project is generated or built', () => {
    expect(at('check-play-version')).toBeLessThan(at('npx expo prebuild'));
    expect(at('check-play-version')).toBeLessThan(at('bundleRelease'));
  });
  it('tags only after the Play publish step', () => {
    expect(at('Publish to Google Play')).toBeLessThan(at('git tag'));
  });
  it('is allowed to push the tag, and derives it from app.config.js', () => {
    expect(WORKFLOW).toMatch(/permissions:\s*\n\s*contents: write/);
    expect(WORKFLOW).toContain('app.config.js');
  });
  it('refuses an already existing tag before building', () => {
    expect(at('ls-remote --tags')).toBeLessThan(at('npx expo prebuild'));
  });
});
