import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TopicsScreen from '../src/screens/TopicsScreen';
import * as profileService from '../src/services/profileService';
import { t } from '../src/i18n';

jest.mock('../src/services/profileService');
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ cefrLevel: 'A1', nativeLanguage: 'it' }),
}));

describe('TopicsScreen', () => {
  it('shows a generic error, never the raw native message, and logs the cause', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (profileService.submitOnboarding as jest.Mock).mockRejectedValueOnce(
      new Error("Call to function 'NativeDatabase.prepareAsync' has been rejected. java.lang.NullPointerException"),
    );
    const { getByText, queryByText, getAllByRole } = render(<TopicsScreen />);
    const boxes = getAllByRole('checkbox');
    fireEvent.press(boxes[0]);
    fireEvent.press(boxes[1]);
    fireEvent.press(getByText(t('topics_cta')));
    await waitFor(() => expect(getByText(t('topics_error'))).toBeTruthy());
    expect(queryByText(/NativeDatabase|NullPointer/)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
