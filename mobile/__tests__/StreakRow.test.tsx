import React from 'react';
import { render } from '@testing-library/react-native';
import StreakRow from '../src/components/ui/StreakRow';
import { colors } from '../src/theme/colors';

function getDotBackgrounds(json: any): string[] {
  const dotsContainer = json.children[0];
  return dotsContainer.children.map((dot: any) => {
    const style = Array.isArray(dot.props.style) ? dot.props.style : [dot.props.style];
    const merged = Object.assign({}, ...style);
    return merged.backgroundColor;
  });
}

describe('StreakRow — dot count', () => {
  it('count=0: all 7 dots are mist', () => {
    const { toJSON } = render(<StreakRow count={0} />);
    const bgs = getDotBackgrounds(toJSON() as any);
    expect(bgs).toHaveLength(7);
    expect(bgs.every((c) => c === colors.mist)).toBe(true);
  });

  it('count=3: first 3 dots gold, last 4 mist', () => {
    const { toJSON } = render(<StreakRow count={3} />);
    const bgs = getDotBackgrounds(toJSON() as any);
    expect(bgs).toHaveLength(7);
    expect(bgs.slice(0, 3).every((c) => c === colors.gold)).toBe(true);
    expect(bgs.slice(3).every((c) => c === colors.mist)).toBe(true);
  });

  it('count=7: all 7 dots gold', () => {
    const { toJSON } = render(<StreakRow count={7} />);
    const bgs = getDotBackgrounds(toJSON() as any);
    expect(bgs).toHaveLength(7);
    expect(bgs.every((c) => c === colors.gold)).toBe(true);
  });

  it('count=20: still renders 7 dots, all gold (capped at 7)', () => {
    const { toJSON } = render(<StreakRow count={20} />);
    const bgs = getDotBackgrounds(toJSON() as any);
    expect(bgs).toHaveLength(7);
    expect(bgs.every((c) => c === colors.gold)).toBe(true);
  });
});
