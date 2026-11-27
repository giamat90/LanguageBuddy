import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import itBase from '../src/i18n/it';
import enBase from '../src/i18n/en';
import { SUPPORTED_NATIVE_LANGUAGES, type NativeLanguage } from '../src/i18n/language';
import i18n, { t, setAppLocale, applyTargetStrings } from '../src/i18n';
import { BASE_TARGET_KEYS, QUIZ_TARGET_KEYS, REQUIRED_TARGET_KEYS, requiredTargetKeys } from '../src/languages/targetStrings';
import { setActivePackForTests, type LanguagePack } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';

const langRoot = join(__dirname, '..', 'src', 'languages');
const targets = readdirSync(langRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(langRoot, d.name, 'strings')))
  .map((d) => d.name);

const placeholders = (s: string) => (s.match(/%\{[a-zA-Z_]+\}/g) ?? []).sort().join(',');
const SAME = (k: string) => /^quiz_q\d_[ab]$/.test(k);
const load = (target: string, ui: NativeLanguage): Record<string, string> => require(`../src/languages/${target}/strings/${ui}`).default;

afterEach(() => { setActivePackForTests(null); setAppLocale('it'); });

describe('target-language string overlays', () => {
  it('exist for German', () => expect(targets).toContain('de'));

  describe.each(targets)('%s', (target) => {
    const it_ = load(target, 'it');
    const keys = Object.keys(it_).sort();

    const pack = require(`../src/languages/${target}`)[target] as LanguagePack;

    it('supplies every required key', () => {
      for (const k of requiredTargetKeys(pack)) expect(keys).toContain(k);
    });

    const offered = pack.uiLanguages as NativeLanguage[];
    it('has exactly the files of its offered app languages', () => {
      expect(offered.slice().sort()).toEqual(readdirSync(join(langRoot, target, 'strings')).map((f) => f.replace('.ts', '')).sort());
    });

    it.each(offered.filter((l) => l !== 'it'))('%s: same keys, placeholders, non-empty, translated', (ui) => {
      const dict = load(target, ui);
      expect(Object.keys(dict).sort()).toEqual(keys);
      const bad = keys.filter((k) => typeof dict[k] !== 'string' || dict[k].trim() === '' || placeholders(dict[k]) !== placeholders(it_[k]));
      expect(bad).toEqual([]);
      if (ui !== 'en') expect(keys.filter((k) => dict[k] === it_[k] && !SAME(k))).toEqual([]);
    });
  });
});

describe('required keys follow the pack (TASK-071)', () => {
  it('a language with a quiz needs the quiz texts', () => {
    expect([...requiredTargetKeys(testPack)]).toEqual([...REQUIRED_TARGET_KEYS]);
    expect([...REQUIRED_TARGET_KEYS]).toEqual([...BASE_TARGET_KEYS, ...QUIZ_TARGET_KEYS]);
    expect(BASE_TARGET_KEYS).toHaveLength(4);
    expect(QUIZ_TARGET_KEYS).toHaveLength(15);
  });

  it('a language without a quiz does not', () => {
    const notRules = requiredTargetKeys(testPackCjk).filter((k) => !k.startsWith('grammar_rule_'));
    expect(notRules).toEqual([...BASE_TARGET_KEYS]);
  });
});

describe('the base strings are free of app- and language-specific text', () => {
  const overlayKeys = (k: string) => (REQUIRED_TARGET_KEYS as readonly string[]).includes(k) || k.startsWith('grammar_rule_') || k === 'welcome_title' || k === 'review_mc_prompt_german';
  it.each(SUPPORTED_NATIVE_LANGUAGES)('%s has no overlay key and never says GermanBuddy', (ui) => {
    const dict = require(`../src/i18n/${ui}`).default as Record<string, string>;
    expect(Object.keys(dict).filter(overlayKeys)).toEqual([]);
    expect(Object.entries(dict).filter(([, v]) => v.includes('GermanBuddy')).map(([k]) => k)).toEqual([]);
  });

  it('it.ts and en.ts name no specific language', () => {
    for (const dict of [itBase, enBase] as Record<string, string>[]) {
      expect(Object.entries(dict).filter(([, v]) => /tedesc|german|deutsch/i.test(v)).map(([k]) => k)).toEqual([]);
    }
  });
});

describe('moved texts are unchanged', () => {
  const pins: [string, NativeLanguage, string][] = [
    ['welcome_subtitle', 'it', 'Una parola di tedesco al giorno, da imparare davvero.'],
    ['welcome_subtitle', 'en', 'One German word a day, learned properly.'],
    ['review_mc_prompt_target', 'it', 'Come si dice in tedesco?'],
    ['review_mc_prompt_target', 'en', 'How do you say it in German?'],
    ['quiz_q1_a', 'it', 'Ich trinke jeden Morgen Kaffee.'],
    ['quiz_q2_b', 'en', 'Ich sehe der Mann.'],
    ['quiz_q3', 'it', 'Come si dice "Spengo la luce"?'],
    ['quiz_q5_a', 'en', 'Ich hätte gern einen Kaffee.'],
    ['grammar_rule_NOUN_GENDER', 'it', 'Il genere va imparato insieme al nome: memorizza sempre der, die o das con la parola.'],
    ['grammar_rule_ACCUSATIVE_MASC', 'it', "All'accusativo solo il maschile cambia: der → den, ein → einen."],
  ];
  it.each(pins)('%s (%s)', (key, ui, text) => {
    setAppLocale(ui);
    expect(t(key as never)).toBe(text);
  });
});

describe('t() and the active pack', () => {
  it('falls back to English for a UI language the overlay lacks', () => {
    setActivePackForTests(testPack);
    setAppLocale('fr');
    expect(t('welcome_subtitle')).toBe('One Spanish word a day, learned properly.');
    setAppLocale('it');
    expect(t('welcome_subtitle')).toBe('Una parola di spagnolo al giorno, da imparare davvero.');
  });

  it('fills %{app} from the pack', () => {
    setAppLocale('en');
    expect(t('notif_word_body')).toContain('GermanBuddy');
    expect(t('welcome_restore_incompatible')).toContain('GermanBuddy');
    expect(t('notif_test_body')).toContain('GermanBuddy');
    setActivePackForTests(testPack);
    expect(t('notif_word_body')).toContain('SpanishBuddy');
    expect(t('welcome_restore_incompatible')).toContain('SpanishBuddy');
    expect(t('notif_test_body')).toContain('SpanishBuddy');
  });

  it('an explicit app option wins and other options still interpolate', () => {
    setAppLocale('en');
    expect(t('backup_err_not_this_app', { app: 'X' })).toContain('X');
  });

  it('rebuilds when the pack changes and again when it is restored', () => {
    setAppLocale('en');
    setActivePackForTests(testPack);
    expect(t('welcome_subtitle')).toContain('Spanish');
    setActivePackForTests(null);
    expect(t('welcome_subtitle')).toContain('German');
    applyTargetStrings(testPack);
    expect(t('welcome_subtitle')).toContain('Spanish');
    expect(i18n.locale).toBe('en');
  });
});
