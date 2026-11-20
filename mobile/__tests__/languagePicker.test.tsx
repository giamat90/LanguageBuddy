import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LanguagePicker from '../src/components/ui/LanguagePicker';
import { LANGUAGES } from '../src/i18n/language';

describe('LanguagePicker', () => {
  it('renders one radio per language, labelled in its own language', () => {
    const { getByTestId } = render(<LanguagePicker value="it" onChange={() => {}} />);
    for (const l of LANGUAGES) {
      const pill = getByTestId(`lang-${l.code}`);
      expect(pill.props.accessibilityRole).toBe('radio');
      expect(pill.props.accessibilityLabel).toBe(l.label);
    }
  });

  it('marks only the selected language as selected', () => {
    const { getByTestId } = render(<LanguagePicker value="fr" onChange={() => {}} />);
    for (const l of LANGUAGES) {
      expect(getByTestId(`lang-${l.code}`).props.accessibilityState).toMatchObject({ selected: l.code === 'fr' });
    }
  });

  it('reports the tapped language', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<LanguagePicker value="it" onChange={onChange} />);
    fireEvent.press(getByTestId('lang-ja'));
    expect(onChange).toHaveBeenCalledWith('ja');
  });

  it('ignores taps while disabled', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<LanguagePicker value="it" onChange={onChange} disabled />);
    fireEvent.press(getByTestId('lang-en'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
