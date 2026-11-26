/** TASK-049: checkPrebuild accepts a good generated project and names each deviation. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkPrebuild } = require('../scripts/lib/prebuildCheck.js');

const variant = { code: 'es', name: 'SpanishBuddy', slug: 'spanishbuddy', scheme: 'spanishbuddy', androidPackage: 'com.giamat90.spanishbuddy' };
const other = { name: 'GermanBuddy', slug: 'germanbuddy', scheme: 'germanbuddy', androidPackage: 'com.giamat90.germanbuddy' };
const expected = { versionCode: 1, versionName: '1.0.1' };

const rules = (slug: string) => `<data-extraction-rules>
  <exclude domain="file" path="mmkv/ai" />
  <exclude domain="file" path="mmkv/notifications-store" />
  <exclude domain="file" path="mmkv/auto-backup" />
</data-extraction-rules>`;

const MANIFEST = `<manifest xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" tools:node="remove"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" tools:node="remove"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/>
  <uses-feature android:name="android.hardware.screen.portrait" android:required="false"/>
  <application android:label="@string/app_name" android:allowBackup="true" android:dataExtractionRules="@xml/spanishbuddy_backup_rules" android:fullBackupContent="@xml/spanishbuddy_backup_rules_legacy">
    <activity android:name=".MainActivity" android:screenOrientation="portrait">
      <intent-filter><data android:scheme="spanishbuddy"/></intent-filter>
    </activity>
  </application>
</manifest>`;
const { addLanguageGuard } = require('../plugins/withLanguageGuard');
const GRADLE: string = addLanguageGuard(`android {
    namespace 'com.giamat90.spanishbuddy'
    defaultConfig {
        applicationId 'com.giamat90.spanishbuddy'
        versionCode 1
        versionName "1.0.1"
    }
}`, 'es');

const dirs: string[] = [];
function project(mutate: (f: Record<string, string | null>) => void = () => {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'prebuild-'));
  dirs.push(dir);
  const files: Record<string, string | null> = {
    'app/build.gradle': GRADLE,
    'app/src/main/AndroidManifest.xml': MANIFEST,
    'app/src/main/res/values/strings.xml': '<resources><string name="app_name">SpanishBuddy</string></resources>',
    'app/src/main/res/xml/spanishbuddy_backup_rules.xml': rules('spanishbuddy'),
    'app/src/main/res/xml/spanishbuddy_backup_rules_legacy.xml': rules('spanishbuddy'),
  };
  mutate(files);
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return dir;
}
const check = (dir: string) => checkPrebuild(dir, variant, [other], expected) as string[];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const mutations: Array<[string, (f: Record<string, string | null>) => void, RegExp]> = [
  ['no language guard', (f) => { f['app/build.gradle'] = GRADLE.replace(/\/\/ withLanguageGuard[\s\S]*/, ''); }, /language guard/],
  ['a guard for another language', (f) => { f['app/build.gradle'] = GRADLE.replace('export { es as activePack }', 'export { de as activePack }'); }, /language guard/],
  ['wrong applicationId', (f) => { f['app/build.gradle'] = GRADLE.replace("applicationId 'com.giamat90.spanishbuddy'", "applicationId 'com.giamat90.germanbuddy'"); }, /applicationId/],
  ['wrong namespace', (f) => { f['app/build.gradle'] = GRADLE.replace("namespace 'com.giamat90.spanishbuddy'", "namespace 'x.y'"); }, /namespace/],
  ['wrong versionCode', (f) => { f['app/build.gradle'] = GRADLE.replace('versionCode 1', 'versionCode 20'); }, /versionCode/],
  ['wrong versionName', (f) => { f['app/build.gradle'] = GRADLE.replace('1.0.1', '2.0.0'); }, /versionName/],
  ['wrong app name', (f) => { f['app/src/main/res/values/strings.xml'] = '<resources><string name="app_name">Other</string></resources>'; }, /app_name/],
  ['backup disabled', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('allowBackup="true"', 'allowBackup="false"'); }, /allowBackup/],
  ['rules of the wrong slug', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('@xml/spanishbuddy_backup_rules"', '@xml/germanbuddy_backup_rules"'); }, /dataExtractionRules/],
  ['legacy rules missing', (f) => { f['app/src/main/res/xml/spanishbuddy_backup_rules_legacy.xml'] = null; }, /legacy\.xml is missing/],
  ['AI store not excluded', (f) => { f['app/src/main/res/xml/spanishbuddy_backup_rules.xml'] = rules('x').replace('mmkv/ai"', 'mmkv/other"'); }, /does not exclude mmkv\/ai/],
  ['a required permission missing', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('<uses-permission android:name="android.permission.VIBRATE"/>', ''); }, /VIBRATE is missing/],
  ['an unexpected permission', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('<uses-feature', '<uses-permission android:name="android.permission.RECORD_AUDIO"/><uses-feature'); }, /unexpected permission .*RECORD_AUDIO/],
  ['a storage permission declared again', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('android.permission.READ_EXTERNAL_STORAGE" tools:node="remove"', 'android.permission.READ_EXTERNAL_STORAGE"'); }, /forbidden permission .*READ_EXTERNAL_STORAGE/],
  ['the overlay permission declared again', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"', 'android.permission.SYSTEM_ALERT_WINDOW"'); }, /forbidden permission .*SYSTEM_ALERT_WINDOW/],
  ['a blocked permission missing altogether', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.split(/\r?\n/).filter((l) => !l.includes('WRITE_EXTERNAL_STORAGE')).join(' '); }, /WRITE_EXTERNAL_STORAGE is not blocked/],
  ['not portrait', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('android:screenOrientation="portrait"', ''); }, /not portrait/],
  ['portrait feature required', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('android:required="false"', 'android:required="true"'); }, /screen\.portrait/],
  ['wrong scheme', (f) => { f['app/src/main/AndroidManifest.xml'] = MANIFEST.replace('android:scheme="spanishbuddy"', 'android:scheme="germanbuddy"'); }, /URL scheme/],
  ['another app left behind', (f) => { f['app/src/main/res/values/extra.xml'] = '<resources><string name="x">GermanBuddy</string></resources>'; }, /mentions the other app GermanBuddy/],
];

describe('checkPrebuild', () => {
  it('accepts a good project', () => {
    expect(check(project())).toEqual([]);
  });
  it.each(mutations)('reports: %s', (_name, mutate, expectedProblem) => {
    const problems = check(project(mutate));
    expect(problems.some((p) => expectedProblem.test(p))).toBe(true);
  });
  it('reports a missing project instead of throwing', () => {
    expect(check(mkdtempSync(join(tmpdir(), 'prebuild-empty-'))).length).toBeGreaterThan(0);
  });
});
