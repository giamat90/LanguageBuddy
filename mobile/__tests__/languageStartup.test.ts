/**
 * The persisted language must drive both the store and the i18n locale at launch
 * (previously only the store was restored, so the UI came back in Italian).
 */

function freshStore(persisted: string | null) {
  let result: { lang: string; locale: string; title: string } | undefined;
  jest.isolateModules(() => {
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV({ id: 'user-store' });
    if (persisted !== null) mmkv.set('nativeLanguage', persisted);
    const { useUserStore } = require('../src/store/useUserStore');
    const i18n = require('../src/i18n');
    result = {
      lang: useUserStore.getState().nativeLanguage,
      locale: i18n.getAppLocale(),
      title: i18n.t('quiz_title'),
    };
  });
  return result!;
}

test('a persisted language is applied to the store and to i18n at startup', () => {
  const r = freshStore('fr');
  expect(r.lang).toBe('fr');
  expect(r.locale).toBe('fr');
  expect(r.title).not.toBe('Qual è il tuo livello?');
});

test('no persisted language starts in the default', () => {
  const r = freshStore(null);
  expect(r.lang).toBe('it');
  expect(r.locale).toBe('it');
});

test('an unknown persisted language starts in the default', () => {
  const r = freshStore('xx');
  expect(r.lang).toBe('it');
  expect(r.locale).toBe('it');
});
