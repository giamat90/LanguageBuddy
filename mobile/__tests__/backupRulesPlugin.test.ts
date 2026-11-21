// eslint-disable-next-line @typescript-eslint/no-var-requires
const xml2js = require('xml2js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../plugins/withAndroidBackupRules');

const { buildDataExtractionRules, buildFullBackupContent, setBackupAttributes } = plugin;

const INCLUDED = ['SQLite/', 'mmkv/'];
// MMKV keeps each store as files/mmkv/<id> plus <id>.crc
const EXCLUDED_STORES = ['ai', 'notifications-store', 'auto-backup'];

async function parse(xml: string) {
  return xml2js.parseStringPromise(xml);
}
const entries = (node: any, tag: 'include' | 'exclude') =>
  (node?.[tag] ?? []).map((e: any) => `${e.$.domain}:${e.$.path}`);

describe('Android cloud-backup rules (Part B)', () => {
  it('data-extraction rules are well-formed and cover cloud backup and device transfer', async () => {
    const doc = await parse(buildDataExtractionRules());
    const rules = doc['data-extraction-rules'];
    expect(rules['cloud-backup']).toHaveLength(1);
    expect(rules['device-transfer']).toHaveLength(1);

    for (const section of [rules['cloud-backup'][0], rules['device-transfer'][0]]) {
      const includes = entries(section, 'include');
      const excludes = entries(section, 'exclude');
      for (const path of INCLUDED) expect(includes).toContain(`file:${path}`);
      for (const id of EXCLUDED_STORES) {
        expect(excludes).toContain(`file:mmkv/${id}`);
        expect(excludes).toContain(`file:mmkv/${id}.crc`);
      }
    }
  });

  it('the legacy full-backup-content has the same includes and excludes', async () => {
    const doc = await parse(buildFullBackupContent());
    const rules = doc['full-backup-content'];
    const includes = entries(rules, 'include');
    const excludes = entries(rules, 'exclude');
    for (const path of INCLUDED) expect(includes).toContain(`file:${path}`);
    for (const id of EXCLUDED_STORES) {
      expect(excludes).toContain(`file:mmkv/${id}`);
      expect(excludes).toContain(`file:mmkv/${id}.crc`);
    }
  });

  it('never lists the AI key store as included, and never excludes the database', async () => {
    for (const xml of [buildDataExtractionRules(), buildFullBackupContent()]) {
      expect(xml).not.toMatch(/<include[^>]*mmkv\/ai"/);
      expect(xml).not.toMatch(/<exclude[^>]*SQLite/);
    }
  });

  it('sets the three attributes on the application element', () => {
    const application: { $: Record<string, string> } = { $: {} };
    setBackupAttributes(application);
    expect(application.$['android:allowBackup']).toBe('true');
    expect(application.$['android:dataExtractionRules']).toMatch(/^@xml\/.+/);
    expect(application.$['android:fullBackupContent']).toMatch(/^@xml\/.+/);
    expect(application.$['android:dataExtractionRules']).not.toBe(application.$['android:fullBackupContent']);
  });

  it('is registered in app.config.js', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../app.config.js');
    const names = config.expo.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(names).toContain('./plugins/withAndroidBackupRules');
  });
});

describe('resource names follow the app slug (TASK-047)', () => {
  it('the manifest attributes use the slug', () => {
    const application: { $: Record<string, string> } = { $: {} };
    setBackupAttributes(application, 'spanishbuddy');
    expect(application.$['android:dataExtractionRules']).toBe('@xml/spanishbuddy_backup_rules');
    expect(application.$['android:fullBackupContent']).toBe('@xml/spanishbuddy_backup_rules_legacy');
  });
  it('defaults to the German names', () => {
    const application: { $: Record<string, string> } = { $: {} };
    setBackupAttributes(application);
    expect(application.$['android:dataExtractionRules']).toBe('@xml/germanbuddy_backup_rules');
    expect(application.$['android:fullBackupContent']).toBe('@xml/germanbuddy_backup_rules_legacy');
  });
  it('resourceNames derives both names from the slug', () => {
    expect(plugin.resourceNames('spanishbuddy')).toEqual({ rules: 'spanishbuddy_backup_rules', legacy: 'spanishbuddy_backup_rules_legacy' });
    expect(plugin.resourceNames()).toEqual({ rules: 'germanbuddy_backup_rules', legacy: 'germanbuddy_backup_rules_legacy' });
  });
});
