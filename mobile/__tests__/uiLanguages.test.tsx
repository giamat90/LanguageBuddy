import React from 'react';
import { render } from '@testing-library/react-native';
import LanguagePicker from '../src/components/ui/LanguagePicker';
import { coerceNativeLanguage, SUPPORTED_NATIVE_LANGUAGES } from '../src/i18n/language';
import { setActivePackForTests } from '../src/languages';
import { testPack } from '../test-support/testPack';
import { de } from '../src/languages/de';

afterEach(() => setActivePackForTests(null));

describe('the pack decides which app languages are offered', () => {
  it('German offers all 13', () => {
    expect(de.uiLanguages).toEqual(SUPPORTED_NATIVE_LANGUAGES);
    const r = render(<LanguagePicker value="it" onChange={() => {}} />);
    expect(r.getAllByRole('radio')).toHaveLength(13);
    expect(r.getByTestId('lang-es')).toBeTruthy();
  });

  it('a pack without Spanish shows 12 and no Spanish', () => {
    setActivePackForTests(testPack);
    const r = render(<LanguagePicker value="it" onChange={() => {}} />);
    expect(r.getAllByRole('radio')).toHaveLength(12);
    expect(r.queryByTestId('lang-es')).toBeNull();
  });

  it('coerceNativeLanguage follows the pack', () => {
    expect(coerceNativeLanguage('es')).toBe('es');
    setActivePackForTests(testPack);
    expect(coerceNativeLanguage('es')).toBe('it');
    expect(coerceNativeLanguage('fr')).toBe('fr');
    expect(coerceNativeLanguage('nonsense')).toBe('it');
  });

  it('falls back to the first offered language when the default is not offered', () => {
    setActivePackForTests({ ...testPack, uiLanguages: ['en', 'fr'] });
    expect(coerceNativeLanguage('it')).toBe('en');
    expect(coerceNativeLanguage('fr')).toBe('fr');
  });
});
