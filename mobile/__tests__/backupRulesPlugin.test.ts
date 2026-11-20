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
    expect(config.expo.plugins).toContain('./plugins/withAndroidBackupRules');
  });
});
