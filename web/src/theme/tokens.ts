/**
 * Design Tokens for Vizora — Electric Horizon
 * Centralized design system values for consistent UI/UX
 */

export const tokens = {
  // Spacing scale (base unit: 4px)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
    '4xl': '64px',
    '5xl': '80px',
  } as const,

  // Border radius scale
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  } as const,

  // Typography scales
  typography: {
    // Display heading - largest
    display: {
      lg: {
        fontSize: '48px',
        fontWeight: 700,
        lineHeight: '1.2',
        letterSpacing: '-0.02em',
      },
      md: {
        fontSize: '36px',
        fontWeight: 700,
        lineHeight: '1.25',
        letterSpacing: '-0.02em',
      },
    },

    // Heading styles
    heading: {
      h1: {
        fontSize: '32px',
        fontWeight: 700,
        lineHeight: '1.2',
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '24px',
        fontWeight: 700,
        lineHeight: '1.3',
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '20px',
        fontWeight: 600,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      h4: {
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      h5: {
        fontSize: '16px',
        fontWeight: 600,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
      h6: {
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
    },

    // Body text styles
    body: {
      lg: {
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '1.6',
        letterSpacing: '0em',
      },
      base: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
      sm: {
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      xs: {
        fontSize: '11px',
        fontWeight: 400,
        lineHeight: '1.4',
        letterSpacing: '0.01em',
      },
    },

    // Code/monospace
    code: {
      sm: {
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '1.4',
        letterSpacing: '0em',
        fontFamily: 'monospace',
      },
    },
  } as const,

  // Shadow/elevation system
  shadow: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px rgba(0, 0, 0, 0.1)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  } as const,

  // Transitions/animations
  transition: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  } as const,

  // Z-index scale
  zIndex: {
    hide: '-1',
    auto: 'auto',
    base: '0',
    docked: '10',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    backdrop: '1040',
    offcanvas: '1050',
    modal: '1060',
    popover: '1070',
    tooltip: '1080',
  } as const,

  // Breakpoints for responsive design
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  } as const,

  // Animation/keyframes
  animation: {
    spin: 'spin 1s linear infinite',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    bounce: 'bounce 1s infinite',
    fadeIn: 'fadeIn 300ms ease-in-out',
    slideIn: 'slideIn 300ms ease-in-out',
    slideOut: 'slideOut 300ms ease-in-out',
  } as const,

  // Border widths
  border: {
    none: '0px',
    xs: '0.5px',
    sm: '1px',
    md: '2px',
    lg: '4px',
  } as const,

  // Opacity scale
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  } as const,

  // Focus ring styles — EH neon green
  focus: {
    ring: '2px',
    ringOffset: '2px',
    ringColor: '#00E5A0',
  } as const,

  // Container widths
  container: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  } as const,
} as const;

// Type exports for better TypeScript support
export type Spacing = keyof typeof tokens.spacing;
export type Radius = keyof typeof tokens.radius;
export type Shadow = keyof typeof tokens.shadow;
export type Transition = keyof typeof tokens.transition;
export type ZIndex = keyof typeof tokens.zIndex;
export type Breakpoint = keyof typeof tokens.breakpoints;

/**
 * Utility function to get spacing value
 */
export function getSpacing(size: Spacing): string {
  return tokens.spacing[size];
}

/**
 * Utility function to get border radius value
 */
export function getRadius(size: Radius): string {
  return tokens.radius[size];
}

/**
 * Utility function to get shadow value
 */
export function getShadow(size: Shadow): string {
  return tokens.shadow[size];
}

/**
 * Utility function to get transition value
 */
export function getTransition(type: Transition): string {
  return tokens.transition[type];
}

/**
 * Utility function to get z-index value
 */
export function getZIndex(level: ZIndex): string {
  return tokens.zIndex[level];
}

/**
 * Utility function to get breakpoint value
 */
export function getBreakpoint(bp: Breakpoint): string {
  return tokens.breakpoints[bp];
}

/**
 * Media query helper
 */
export function mediaQuery(breakpoint: Breakpoint): string {
  return `@media (min-width: ${tokens.breakpoints[breakpoint]})`;
}
