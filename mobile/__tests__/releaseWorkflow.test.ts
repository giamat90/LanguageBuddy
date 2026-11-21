/** TASK-047: the release workflow builds whichever app it is told to. */
import { readFileSync } from 'fs';
import { join } from 'path';

const yml = readFileSync(join(__dirname, '..', '..', '.github', 'workflows', 'release-android.yml'), 'utf8');
const at = (needle: string) => {
  const i = yml.indexOf(needle);
  if (i < 0) throw new Error(`workflow lacks "${needle}"`);
  return i;
};

describe('release-android.yml', () => {
  it('has an app choice with de and es', () => {
    const block = yml.slice(at('\n      app:'), at('\n      track:'));
    expect(block).toMatch(/type: choice/);
    expect(block).toMatch(/- de/);
    expect(block).toMatch(/- es/);
    expect(block).toMatch(/default: de/);
  });
  it('hard-codes no package name', () => {
    expect(yml).not.toMatch(/com\.giamat90/);
    expect(yml).toMatch(/packageName: \$\{\{ steps\.pkg\.outputs\.package \}\}/);
  });
  it('activates the language after npm ci and before the guard and prebuild', () => {
    const ci = at('npm ci');
    const activate = at('set-active-language.mjs');
    expect(ci).toBeLessThan(activate);
    expect(activate).toBeLessThan(at('check-play-version.js'));
    expect(activate).toBeLessThan(at('expo prebuild'));
  });
  it('passes the language to releaseTag', () => {
    expect(yml).toMatch(/releaseTag\(.*process\.env\.APP_LANG\)/);
  });
});
