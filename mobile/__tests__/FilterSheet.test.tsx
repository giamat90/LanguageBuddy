import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FilterButton, FilterSheet, type FilterSection } from '../src/components/ui/FilterSheet';
import { MaterialIcons } from '@expo/vector-icons';
import { t } from '../src/i18n';

const sections = (onSelect = jest.fn(), selected: string | null = null): FilterSection[] => [
  {
    id: 'level', title: t('filter_section_level'), selected, onSelect,
    options: [
      { key: null, label: t('stats_words_all_levels'), count: 70, testID: 'filter-opt-level-all' },
      { key: 'A1', label: 'A1', count: 35, testID: 'filter-opt-level-A1' },
    ],
  },
  {
    id: 'status', title: t('filter_section_status'), selected: null, onSelect: jest.fn(),
    options: [{ key: 'todo', label: t('catalog_status_todo'), count: 68, marker: 'todo', testID: 'filter-opt-status-todo' }],
  },
];

describe('FilterButton', () => {
  it('has no badge at 0 and shows the number otherwise, with the count in the label', () => {
    const none = render(<FilterButton activeCount={0} onPress={() => {}} />);
    expect(none.queryByTestId('filter-badge')).toBeNull();
    expect(none.getByLabelText(t('filter_open'))).toBeTruthy();
    const two = render(<FilterButton activeCount={2} onPress={() => {}} />);
    expect(two.getByTestId('filter-badge').props.children).toBe(2);
    expect(two.getByLabelText(t('filter_open_active', { count: 2 }))).toBeTruthy();
  });

  it('uses the standard Material filter icon, not an emoji', () => {
    const { UNSAFE_getByType, queryByText } = render(<FilterButton activeCount={0} onPress={() => {}} />);
    expect(UNSAFE_getByType(MaterialIcons).props.name).toBe('filter-list');
    expect(queryByText('🎚')).toBeNull();
  });

  it('calls onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<FilterButton activeCount={0} onPress={onPress} />);
    fireEvent.press(getByTestId('filter-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('FilterSheet', () => {
  const base = { title: t('filter_open'), onClose: jest.fn(), onReset: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing while hidden', () => {
    const { queryByTestId } = render(<FilterSheet {...base} visible={false} sections={sections()} />);
    expect(queryByTestId('filter-opt-level-A1')).toBeNull();
  });

  it('shows sections, options with counts and the selected state', () => {
    const { getByTestId, getByText } = render(<FilterSheet {...base} visible sections={sections(jest.fn(), 'A1')} />);
    expect(getByText(t('filter_section_level'))).toBeTruthy();
    const a1 = getByTestId('filter-opt-level-A1');
    expect(a1.props.accessibilityRole).toBe('button');
    expect(a1.props.accessibilityState).toMatchObject({ selected: true });
    expect(a1.props.accessibilityLabel).toBe(t('stats_words_filter_a11y', { name: 'A1', count: 35 }));
    expect(getByTestId('filter-opt-level-all').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('status options show their marker (it doubles as the legend)', () => {
    const { getByTestId } = render(<FilterSheet {...base} visible sections={sections()} />);
    expect(getByTestId('status-marker-todo')).toBeTruthy();
  });

  it('selecting calls onSelect(key); the selected option and "all" clear with null', () => {
    const onSelect = jest.fn();
    const { getByTestId, rerender } = render(<FilterSheet {...base} visible sections={sections(onSelect)} />);
    fireEvent.press(getByTestId('filter-opt-level-A1'));
    expect(onSelect).toHaveBeenLastCalledWith('A1');
    fireEvent.press(getByTestId('filter-opt-level-all'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    rerender(<FilterSheet {...base} visible sections={sections(onSelect, 'A1')} />);
    fireEvent.press(getByTestId('filter-opt-level-A1'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('Fatto, the backdrop and the Android back button close; Azzera resets', () => {
    const onClose = jest.fn();
    const onReset = jest.fn();
    const { getByTestId, UNSAFE_getByProps } = render(
      <FilterSheet title="x" visible sections={sections()} onClose={onClose} onReset={onReset} />,
    );
    fireEvent.press(getByTestId('filter-done'));
    fireEvent.press(getByTestId('filter-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    UNSAFE_getByProps({ transparent: true }).props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.press(getByTestId('filter-reset'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
