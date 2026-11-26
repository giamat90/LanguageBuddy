import {
  LANGUAGES,
  SUPPORTED_NATIVE_LANGUAGES,
  DEFAULT_NATIVE_LANGUAGE,
  coerceNativeLanguage,
  dateLocale,
  detectDeviceLanguage,
  isNativeLanguage,
  isRtl,
  languageEnglishName,
  languageLabel,
} from '../src/i18n/language';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { testPackCjk } from '../test-support/testPackCjk';

describe('language registry', () => {
  it('lists the 13 app languages in display order', () => {
    expect([...SUPPORTED_NATIVE_LANGUAGES]).toEqual([
      'it', 'en', 'fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar',
    ]);
  });

  it('keeps Italian as the data default (it is the DB column default)', () => {
    expect(DEFAULT_NATIVE_LANGUAGE).toBe('it');
  });

  it('has a unique, non-empty native label and English name for every language', () => {
    const labels = LANGUAGES.map((l) => l.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const l of LANGUAGES) {
      expect(l.label.trim()).not.toBe('');
      expect(languageEnglishName(l.code)).toMatch(/^[A-Z][A-Za-z ]+$/);
      expect(languageLabel(l.code)).toBe(l.label);
    }
  });

  it('uses a date locale that Intl accepts', () => {
    for (const l of LANGUAGES) {
      expect(() => new Intl.DateTimeFormat(dateLocale(l.code)).format(new Date(0))).not.toThrow();
    }
  });

  it('marks only Arabic as right-to-left', () => {
    expect(LANGUAGES.filter((l) => isRtl(l.code)).map((l) => l.code)).toEqual(['ar']);
  });

  it('formats Arabic dates in the Gregorian calendar', () => {
    const s = new Date(Date.UTC(2026, 9, 15, 12)).toLocaleDateString(dateLocale('ar'), { timeZone: 'UTC' });
    expect(s).toMatch(/2026|٢٠٢٦/);
  });
});

describe('isNativeLanguage / coerceNativeLanguage', () => {
  it('accepts every supported code', () => {
    for (const code of SUPPORTED_NATIVE_LANGUAGES) {
      expect(isNativeLanguage(code)).toBe(true);
      expect(coerceNativeLanguage(code)).toBe(code);
    }
  });

  it.each([['xx'], [''], [null], [undefined], [42], [{}], ['FR'], ['__proto__'], ['constructor']])(
    'maps %p to the default',
    (input) => {
      expect(isNativeLanguage(input)).toBe(false);
      expect(coerceNativeLanguage(input)).toBe('it');
    },
  );
});

describe('detectDeviceLanguage', () => {
  it.each([
    ['fr_FR', 'fr'],
    ['fr-CA', 'fr'],
    ['zh-Hans-CN', 'zh'],
    ['zh_TW', 'zh'],
    ['pt_PT', 'pt'],
    ['PT', 'pt'],
    ['it_IT', 'it'],
    ['en_GB', 'en'],
    ['ar_EG', 'ar'],
    ['de_DE', 'en'],
    ['', 'en'],
    ['???', 'en'],
  ])('%s -> %s', (id, expected) => {
    expect(detectDeviceLanguage(id)).toBe(expected);
  });

  it('falls back to English when there is no identifier', () => {
    expect(detectDeviceLanguage(null)).toBe('en');
    expect(detectDeviceLanguage(undefined)).toBe('en');
  });

  // TASK-071: a phone language the app does not offer starts in English, not in Italian.
  describe('in an app that offers only some languages', () => {
    afterEach(() => setActivePackForTests(null));

    it.each([
      ['fr_FR', 'en'], ['zh_CN', 'en'], ['de_DE', 'en'], ['it_IT', 'it'], ['en_GB', 'en'], ['', 'en'],
    ])('Italian and English only: %s -> %s', (id, expected) => {
      setActivePackForTests(testPackCjk);
      expect(detectDeviceLanguage(id)).toBe(expected);
    });

    it('an app without the language of the phone: Spanish phone, no Spanish -> English', () => {
      setActivePackForTests(testPack);
      expect(detectDeviceLanguage('es_ES')).toBe('en');
    });

    it('an app without English still gets an offered language', () => {
      setActivePackForTests({ ...testPackCjk, uiLanguages: ['fr', 'pt'] });
      expect(detectDeviceLanguage('de_DE')).toBe('fr');
    });
  });
});
