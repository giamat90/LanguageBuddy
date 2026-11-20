import React from 'react';
import { render } from '@testing-library/react-native';
import ArticleBadge from '../src/components/ui/ArticleBadge';
import { colors } from '../src/theme/colors';

describe('ArticleBadge — color correctness', () => {
  it('der: uses derBlueBg background and derBlue text', () => {
    const { toJSON } = render(<ArticleBadge article="der" word="Hund" />);
    const json = toJSON() as any;
    expect(json.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.derBlueBg }),
      ])
    );
    expect(json.children[0].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.derBlue }),
      ])
    );
  });

  it('die: uses diePinkBg background and diePink text', () => {
    const { toJSON } = render(<ArticleBadge article="die" word="Katze" />);
    const json = toJSON() as any;
    expect(json.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.diePinkBg }),
      ])
    );
    expect(json.children[0].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.diePink }),
      ])
    );
  });

  it('das: uses dasGrayBg background and dasGray text', () => {
    const { toJSON } = render(<ArticleBadge article="das" word="Kind" />);
    const json = toJSON() as any;
    expect(json.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.dasGrayBg }),
      ])
    );
    expect(json.children[0].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.dasGray }),
      ])
    );
  });

  it('null: renders nothing', () => {
    const { toJSON } = render(<ArticleBadge article={null} />);
    expect(toJSON()).toBeNull();
  });
});
