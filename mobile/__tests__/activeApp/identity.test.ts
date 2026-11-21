/** Which app is this? Pack, variant, config and UI strings must all agree (and never mention the other app). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getActivePack } from '../../src/languages';
import { t, setAppLocale } from '../../src/i18n';
import { EXPECT, current, activeCode } from '../../test-support/appExpectations';
/* eslint-disable @typescript-eslint/no-var-requires */
const { loadVariant } = require('../../scripts/lib/variants.js');
const { buildExpoConfig } = require('../../scripts/lib/variants.js');

const root = join(__dirname, '..', '..');

describe('active app identity', () => {
  it('has an expectations row (the gate for a new language)', () => {
    expect(() => current()).not.toThrow();
  });

  it('pack, variant and expectations agree', () => {
    const e = current();
    const pack = getActivePack();
    const variant = loadVariant(activeCode());
    expect(pack.app).toEqual({ name: e.appName, backupTag: e.backupTag, dbFile: e.dbFile });
    expect(variant.name).toBe(e.appName);
    expect(variant.androidPackage).toBe(e.packageName);
    expect(variant.slug).toBe(e.backupTag.toLowerCase());
    expect(pack.speech.locale).toBe(e.speechLocale);
    expect(pack.ai.languageName).toBe(e.aiLanguageName);
    expect(pack.uiLanguages).toEqual(e.uiLanguages);
  });

  it('the Expo config of the active app has that package (prevents a Spanish build with the German id)', () => {
    const cfg = buildExpoConfig(loadVariant(activeCode()), {});
    expect(cfg.android.package).toBe(current().packageName);
    expect(cfg.name).toBe(current().appName);
  });

  it('the generated seams name only the active language (prevents shipping two banks)', () => {
    const seam = readFileSync(join(root, 'src', 'languages', 'active.ts'), 'utf8');
    expect(seam).toContain(`export { ${activeCode()} as activePack }`);
    expect(readFileSync(join(root, 'src', 'data', 'wordbank', 'active.ts'), 'utf8')).toContain(`./${activeCode()}/A1.json`);
  });

  it('UI strings show the active app name and never the other one (prevents a leftover hard-coded name)', () => {
    const e = current();
    const others = Object.values(EXPECT).filter((x) => x.appName !== e.appName).map((x) => x.appName);
    const keys = ['welcome_restore_incompatible', 'settings_autobackup_hint', 'notif_word_body', 'notif_test_body',
      'backup_err_not_this_app', 'backup_dialog_title'] as const;
    for (const lang of getActivePack().uiLanguages) {
      setAppLocale(lang);
      for (const k of keys) {
        const text = t(k);
        expect(text).toContain(e.appName);
        for (const o of others) expect(text).not.toContain(o);
      }
    }
    setAppLocale('it');
  });
});
