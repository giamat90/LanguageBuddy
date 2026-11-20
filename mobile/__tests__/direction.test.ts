import { I18nManager } from 'react-native';
import { applyLayoutDirection } from '../src/i18n/direction';

describe('applyLayoutDirection', () => {
  const allow = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
  const force = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});

  beforeEach(() => {
    allow.mockClear();
    force.mockClear();
  });

  function setRtl(v: boolean) {
    Object.defineProperty(I18nManager, 'isRTL', { value: v, configurable: true });
  }

  it('forces RTL for Arabic when the layout is LTR, and reports the change', () => {
    setRtl(false);
    expect(applyLayoutDirection('ar')).toEqual({ changed: true });
    expect(allow).toHaveBeenCalledWith(true);
    expect(force).toHaveBeenCalledWith(true);
  });

  it('does nothing when Arabic is selected and the layout is already RTL', () => {
    setRtl(true);
    expect(applyLayoutDirection('ar')).toEqual({ changed: false });
    expect(force).not.toHaveBeenCalled();
  });

  it('restores LTR when a left-to-right language is chosen from RTL', () => {
    setRtl(true);
    expect(applyLayoutDirection('it')).toEqual({ changed: true });
    expect(force).toHaveBeenCalledWith(false);
  });

  it('does nothing for LTR languages in an LTR layout', () => {
    setRtl(false);
    expect(applyLayoutDirection('ja')).toEqual({ changed: false });
    expect(force).not.toHaveBeenCalled();
  });
});
