// TASK-028: what versionCodes does Google Play already hold, and is a new one acceptable?
// Pure helpers (usedVersionCodes, assertNewVersionCode, releaseTag) plus a small Play
// Developer API reader that uses only Node built-ins (no dependency to maintain).
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

function toCode(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Every versionCode Play has seen: those on any track release AND those of uploaded
 * bundles (a bundle that sits on no track still burns its code). Sorted, unique.
 */
function usedVersionCodes(tracks, bundles) {
  const codes = new Set();
  for (const track of Array.isArray(tracks) ? tracks : []) {
    for (const release of Array.isArray(track && track.releases) ? track.releases : []) {
      for (const c of Array.isArray(release && release.versionCodes) ? release.versionCodes : []) {
        const n = toCode(c);
        if (n !== null) codes.add(n);
      }
    }
  }
  for (const b of Array.isArray(bundles) ? bundles : []) {
    const n = toCode(b && b.versionCode);
    if (n !== null) codes.add(n);
  }
  return [...codes].sort((a, b) => a - b);
}

/** Throws unless `requested` is a positive integer strictly above every used code. */
function assertNewVersionCode(requested, used) {
  const n = toCode(requested);
  if (n === null) throw new Error(`versionCode must be a positive integer, got "${String(requested)}"`);
  const highest = used.length ? Math.max(...used) : 0;
  if (n <= highest) {
    throw new Error(`versionCode ${n} is not higher than the highest already on Google Play (${highest}); use ${highest + 1} or more`);
  }
}

/**
 * Git tag for a release: "v" + the app's version name (MAJOR.MINOR.versionCode); apps other than
 * German are prefixed with their language code ("es-v1.0.1") so two apps never collide.
 */
function releaseTag(version, code = 'de') {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`version name must look like 1.0.16, got "${String(version)}"`);
  }
  if (typeof code !== 'string' || !/^[a-z]{2,3}$/.test(code)) throw new Error(`language code must look like es, got "${String(code)}"`);
  return code === 'de' ? `v${version}` : `${code}-v${version}`;
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signJwt(serviceAccount, nowSeconds) {
  const claims = { iss: serviceAccount.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${b64url(signature)}`;
}

/**
 * Reads the used versionCodes from Play through a throw-away edit (never committed, always
 * deleted). Errors carry the step and HTTP status only: no key, token or response body.
 */
async function fetchPlayVersionCodes({ serviceAccount, packageName, fetchImpl = fetch, now = () => Date.now() }) {
  if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('service account is missing client_email or private_key');
  }
  let assertion;
  try {
    assertion = signJwt(serviceAccount, Math.floor(now() / 1000));
  } catch {
    throw new Error('could not sign the token request (is private_key valid?)');
  }
  const tokenRes = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!tokenRes.ok) throw new Error(`token request failed (HTTP ${tokenRes.status})`);
  const { access_token: token } = await tokenRes.json();
  if (!token) throw new Error('token response had no access_token');

  const auth = { authorization: `Bearer ${token}` };
  const call = async (step, method, url, body) => {
    const res = await fetchImpl(url, {
      method,
      headers: body ? { ...auth, 'content-type': 'application/json' } : auth,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${step} failed (HTTP ${res.status})`);
    return res.json();
  };

  const base = `${API}/${encodeURIComponent(packageName)}/edits`;
  const edit = await call('create edit', 'POST', base, {});
  try {
    const tracks = await call('list tracks', 'GET', `${base}/${edit.id}/tracks`);
    const bundles = await call('list bundles', 'GET', `${base}/${edit.id}/bundles`);
    return usedVersionCodes(tracks.tracks, bundles.bundles);
  } finally {
    await fetchImpl(`${base}/${edit.id}`, { method: 'DELETE', headers: auth }).catch(() => {});
  }
}

module.exports = { usedVersionCodes, assertNewVersionCode, releaseTag, fetchPlayVersionCodes };
