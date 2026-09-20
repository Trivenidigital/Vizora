/** @type {import('tailwindcss').Config} */
const {
  cssVarColors,
  cssVarEhColors,
  cssVarSemanticColors,
  tokens,
  varName,
} = require('./tailwind.theme.cjs');

/** The neon accent, for the glow shadows and keyframes below. */
const NEON = varName('primary', 500);

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  /*
   * `darkMode` is deliberately absent. Dark mode was removed (plan §3 D1): the
   * `.dark` token block is gone and nothing applies the class, so leaving
   * `darkMode: 'class'` configured would keep Tailwind emitting `dark:` variants
   * that can never match — dead CSS in every bundle. The ~467 inert `dark:`
   * utilities already in the JSX are left in place and retire under the ratchet
   * per-wave; this line is what stops them costing anything at runtime.
   */
  theme: {
    extend: {
      /**
       * Named font-family utilities.
       *
       * These exist so nobody has to reach for an arbitrary value. The app used
       * `font-[var(--font-sora)]` at 35 call sites, which Tailwind types as
       * font-WEIGHT — `font-weight: var(--font-sora)` resolves to a font stack,
       * which is invalid, so the declaration was dropped and Sora never
       * applied. (`dataTypes.length` rejects `var()`, so the colour-namespace
       * inference that makes `text-[var(--x)]` safe does not apply here.)
       *
       * `font-sora` emits font-family and cannot be mis-typed. Prefer these over
       * `font-[family-name:var(...)]`, which is correct but easy to get wrong
       * again. The CSS variables come from next/font in app/layout.tsx.
       */
      fontFamily: {
        sora: ['var(--font-sora)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        dm: ['var(--font-dm)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /**
       * Every colour here points at a CSS variable declared in globals.css
       * rather than at a literal, so the palette can be re-pointed from `:root`
       * instead of from a rebuild — which is what Phase 1 of the redesign does.
       * The values themselves live in `src/theme/palette.js`; the variable
       * references are derived in `tailwind.theme.cjs`, which also explains why
       * the variables hold bare CHANNELS (so `bg-error-500/10` keeps working).
       */
      colors: {
        /*
         * The SEMANTIC tokens, as named channel-backed colours.
         *
         * Spread FIRST, and the four that share a name with a ramp are merged
         * into it below as a `DEFAULT` rather than sitting beside it.
         *
         * ── Why the order and the merge both matter ──────────────────────
         * These were originally spread LAST, with a comment claiming a name
         * collision would "break the build rather than quietly winning". That
         * was wrong, and wrong in the worst direction. `success`, `warning`,
         * `error` and `info` exist in BOTH sets: ramp objects here, flat
         * strings there. Spreading the strings last replaced each ramp object
         * outright, so every `bg-error-500`, `text-success-700`,
         * `bg-warning-500/10` — 141 classes across the app — silently stopped
         * emitting. Tailwind does not error on that; it just drops the scale.
         * It took a screenshot diff to find: "5 online" on the dashboard went
         * from green to grey, 391 px, and `Toast`'s four AA-computed fills
         * (`bg-success-700` and friends) left white text on no background at
         * all.
         *
         * `DEFAULT` is Tailwind's own idiom for "this name is both a scale and
         * a single colour": `bg-error` resolves to the flat token, and
         * `bg-error-500` still resolves to the ramp. Nothing has to choose.
         */
        ...cssVarSemanticColors,

        // Ramps. Merged with the flat token of the same name where one exists,
        // so `bg-error` and `bg-error-500` both work.
        primary: cssVarColors.primary,
        neutral: cssVarColors.neutral,
        success: { ...cssVarColors.success, DEFAULT: cssVarSemanticColors.success },
        warning: { ...cssVarColors.warning, DEFAULT: cssVarSemanticColors.warning },
        error: { ...cssVarColors.error, DEFAULT: cssVarSemanticColors.error },
        info: { ...cssVarColors.info, DEFAULT: cssVarSemanticColors.info },

        // Electric Horizon namespace
        eh: cssVarEhColors,
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
        // Neon glow shadows. Same colour as `primary-500`, so they reference it
        // rather than restating rgba(0, 229, 160) five more times — box-shadow
        // takes no <alpha-value>, so the alphas are written out per stop.
        neon: `0 0 12px rgb(var(${NEON}) / 0.25), 0 0 4px rgb(var(${NEON}) / 0.1)`,
        'neon-sm': `0 0 6px rgb(var(${NEON}) / 0.2)`,
        'neon-lg': `0 0 28px rgb(var(${NEON}) / 0.3), 0 0 8px rgb(var(${NEON}) / 0.15)`,
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
        'neon-pulse': 'neonPulse 2s ease-in-out infinite',
        'glow-breathe': 'glowBreathe 4s ease-in-out infinite',
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
        neonPulse: {
          '0%, 100%': { opacity: '1', boxShadow: `0 0 8px rgb(var(${NEON}) / 0.25)` },
          '50%': { opacity: '0.4', boxShadow: `0 0 4px rgb(var(${NEON}) / 0.15)` },
        },
        glowBreathe: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
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
