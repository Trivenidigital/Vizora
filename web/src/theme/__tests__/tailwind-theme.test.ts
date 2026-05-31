import { semanticColors } from '../colors';
import { tokens } from '../tokens';

const tailwindTheme = require('../../../tailwind.theme.cjs');

describe('tailwind.theme.cjs', () => {
  it('stays in sync with the TypeScript theme values used by Tailwind', () => {
    expect(tailwindTheme.semanticColors).toEqual(semanticColors);
    expect(tailwindTheme.tokens).toEqual({
      spacing: tokens.spacing,
      radius: tokens.radius,
      shadow: tokens.shadow,
      transition: tokens.transition,
      zIndex: tokens.zIndex,
      breakpoints: tokens.breakpoints,
      animation: tokens.animation,
      border: tokens.border,
      opacity: tokens.opacity,
    });
  });
});
