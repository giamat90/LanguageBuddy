/** TASK-068: Gradle must not bundle one language's JavaScript into another language's app. */
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { addLanguageGuard } = require('../plugins/withLanguageGuard');

const GRADLE = `apply plugin: "com.android.application"
android {
    namespace 'com.giamat90.frenchbuddy'
}
`;

describe('withLanguageGuard', () => {
  const out: string = addLanguageGuard(GRADLE, 'fr');

  it('keeps the original build.gradle and appends the guard', () => {
    expect(out.startsWith(GRADLE)).toBe(true);
    expect(out).toContain('export { fr as activePack }');
  });
  it('runs before every JS bundle task and fails the build', () => {
    expect(out).toMatch(/createBundle\.\*JsAndAssets/);
    expect(out).toContain('doFirst');
    expect(out).toContain('GradleException');
    expect(out).toContain('src/languages/active.ts');
    expect(out).toContain('with-language');
  });
  it('is idempotent', () => {
    expect(addLanguageGuard(out, 'fr')).toBe(out);
  });
  it('replaces a guard written for another language', () => {
    const es: string = addLanguageGuard(out, 'es');
    expect(es).toContain('export { es as activePack }');
    expect(es).not.toContain('export { fr as activePack }');
    expect(es).toBe(addLanguageGuard(GRADLE, 'es'));
  });
  it.each([undefined, '', 'FR', 'fra', "fr'"])('rejects the code %p', (code) => {
    expect(() => addLanguageGuard(GRADLE, code)).toThrow(/language code/);
  });
  it('looks for exactly the line the seam generator writes', () => {
    const seam = readFileSync(join(__dirname, '..', 'src', 'languages', 'active.ts'), 'utf8');
    expect(seam).toContain('export { de as activePack }');
  });
});

describe('the local bundle script (TASK-068)', () => {
  const bat = readFileSync(join(__dirname, '..', '..', 'build_bundle_android_release.bat'), 'utf8');
  it('calls Gradle by path: cmd may not search the current folder', () => {
    expect(bat).toContain('call .\\gradlew.bat bundleRelease');
    expect(bat).not.toMatch(/call\s+gradlew/i);
  });
});
