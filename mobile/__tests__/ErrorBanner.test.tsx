import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorBanner from '../src/components/ErrorBanner';

describe('ErrorBanner', () => {
  it('test_ErrorBanner_renders_null_when_no_message', () => {
    const { toJSON } = render(<ErrorBanner message={null} onDismiss={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('test_ErrorBanner_renders_message', () => {
    const { getByText } = render(
      <ErrorBanner message="Nessuna connessione." onDismiss={jest.fn()} />,
    );
    expect(getByText('Nessuna connessione.')).toBeTruthy();
  });

  it('test_ErrorBanner_calls_onDismiss', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <ErrorBanner message="Errore" onDismiss={onDismiss} />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
