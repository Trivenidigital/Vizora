/** @type {import('tailwindcss').Config} */
const { semanticColors } = require('./src/theme/colors');
const { tokens } = require('./src/theme/tokens');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic colors
        primary: semanticColors.primary,
        success: semanticColors.success,
        warning: semanticColors.warning,
        error: semanticColors.error,
        info: semanticColors.info,
        neutral: semanticColors.neutral,
      },
      spacing: {
        xs: tokens.spacing.xs,
        sm: tokens.spacing.sm,
        md: tokens.spacing.md,
        lg: tokens.spacing.lg,
        xl: tokens.spacing.xl,
        '2xl': tokens.spacing['2xl'],
        '3xl': tokens.spacing['3xl'],
        '4xl': tokens.spacing['4xl'],
        '5xl': tokens.spacing['5xl'],
      },
      borderRadius: {
        xs: tokens.radius.xs,
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl,
        '2xl': tokens.radius['2xl'],
        full: tokens.radius.full,
      },
      boxShadow: {
        xs: tokens.shadow.xs,
        sm: tokens.shadow.sm,
        md: tokens.shadow.md,
        lg: tokens.shadow.lg,
        xl: tokens.shadow.xl,
        '2xl': tokens.shadow['2xl'],
        inner: tokens.shadow.inner,
      },
      transitionDuration: {
        fast: tokens.transition.fast,
        normal: tokens.transition.normal,
        slow: tokens.transition.slow,
      },
      zIndex: {
        hide: tokens.zIndex.hide,
        auto: tokens.zIndex.auto,
        base: tokens.zIndex.base,
        docked: tokens.zIndex.docked,
        dropdown: tokens.zIndex.dropdown,
        sticky: tokens.zIndex.sticky,
        fixed: tokens.zIndex.fixed,
        backdrop: tokens.zIndex.backdrop,
        modal: tokens.zIndex.modal,
        popover: tokens.zIndex.popover,
        tooltip: tokens.zIndex.tooltip,
      },
      screens: {
        xs: tokens.breakpoints.xs,
        sm: tokens.breakpoints.sm,
        md: tokens.breakpoints.md,
        lg: tokens.breakpoints.lg,
        xl: tokens.breakpoints.xl,
        '2xl': tokens.breakpoints['2xl'],
      },
      animation: {
        spin: tokens.animation.spin,
        pulse: tokens.animation.pulse,
        bounce: tokens.animation.bounce,
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideUp: 'slideUp 0.3s ease-out',
        slideDown: 'slideDown 0.3s ease-out',
        slideLeft: 'slideLeft 0.3s ease-out',
        slideRight: 'slideRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      borderWidth: {
        none: tokens.border.none,
        xs: tokens.border.xs,
        sm: tokens.border.sm,
        md: tokens.border.md,
        lg: tokens.border.lg,
      },
      opacity: tokens.opacity,
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
    },
  },
  plugins: [],
};
