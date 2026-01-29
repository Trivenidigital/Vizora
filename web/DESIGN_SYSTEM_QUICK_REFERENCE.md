# Vizora Design System - Quick Reference Guide

## Using the Theme System

### Accessing Theme in Components
```tsx
import { useTheme } from '@/components/providers/ThemeProvider';

export function MyComponent() {
  const { mode, isDark, setMode } = useTheme();

  return (
    <div>
      Current theme: {mode}
      {isDark && <p>Dark mode is active</p>}
      <button onClick={() => setMode('dark')}>
        Switch to Dark Mode
      </button>
    </div>
  );
}
```

## Using Semantic Colors

### In CSS/Tailwind
```tsx
// Success state
<div className="bg-success-100 dark:bg-success-900 text-success-800 dark:text-success-200">
  Success message
</div>

// Error state
<div className="bg-error-100 dark:bg-error-900 text-error-800 dark:text-error-200">
  Error message
</div>

// Status indicator
<span className="w-2 h-2 bg-success-500 rounded-full"></span> Online
```

### In TypeScript
```tsx
import { semanticColors, statusColors } from '@/theme/colors';

const primaryColor = semanticColors.primary.light; // #0284c7
const successDark = semanticColors.success.dark;   // #22c55e
const onlineColor = statusColors.online.light;     // #16a34a
```

## Using Design Tokens

### Spacing
```tsx
import { tokens, getSpacing } from '@/theme/tokens';

// Via tokens object
const padding = tokens.spacing.lg; // '16px'

// Via utility function
const margin = getSpacing('xl'); // '24px'

// In Tailwind
<div className="p-lg m-xl"> {/* lg = 16px, xl = 24px */}
```

### Typography
```tsx
import { tokens } from '@/theme/tokens';

// Heading styles
const h1Style = tokens.typography.heading.h1;
// { fontSize: '32px', fontWeight: 700, lineHeight: '1.2', letterSpacing: '-0.02em' }

// Body styles
const bodyStyle = tokens.typography.body.base;
// { fontSize: '14px', fontWeight: 400, lineHeight: '1.5' }
```

### Shadows
```tsx
import { tokens, getShadow } from '@/theme/tokens';

// Via tokens object
const shadow = tokens.shadow.md; // '0 4px 6px rgba(0,0,0,0.1), ...'

// Via utility function
const elevated = getShadow('lg');

// In Tailwind
<div className="shadow-md"> {/* Medium shadow */}
```

### Z-Index
```tsx
import { tokens, getZIndex } from '@/theme/tokens';

// Via tokens object
const zTooltip = tokens.zIndex.tooltip; // '1080'

// Via utility function
const zModal = getZIndex('modal'); // '1060'

// In CSS
const styles = {
  zIndex: tokens.zIndex.modal,
};
```

## Common Dark Mode Patterns

### Text Colors
```tsx
// Light background, dark text
<h1 className="text-gray-900 dark:text-gray-50">
  Heading
</h1>

// Secondary text
<p className="text-gray-600 dark:text-gray-400">
  Secondary text
</p>
```

### Cards/Surfaces
```tsx
<div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-lg">
  {/* Content */}
</div>
```

### Borders
```tsx
<div className="border border-gray-300 dark:border-gray-700">
  {/* Content */}
</div>
```

### Hover States
```tsx
<button className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
  Click me
</button>
```

### Input Fields
```tsx
<input
  className="bg-white dark:bg-gray-800
             border border-gray-300 dark:border-gray-700
             text-gray-900 dark:text-gray-50
             placeholder-gray-400 dark:placeholder-gray-500
             focus:ring-2 focus:ring-primary-500"
/>
```

## Status Color Usage

```tsx
// Online status
<span className="w-2 h-2 bg-success-500 rounded-full"></span>
<span className="text-success-600 dark:text-success-400">Online</span>

// Offline status
<span className="w-2 h-2 bg-error-500 rounded-full"></span>
<span className="text-error-600 dark:text-error-400">Offline</span>

// Idle status
<span className="w-2 h-2 bg-warning-500 rounded-full"></span>
<span className="text-warning-600 dark:text-warning-400">Idle</span>

// Processing status
<span className="w-2 h-2 bg-info-500 rounded-full animate-pulse"></span>
<span className="text-info-600 dark:text-info-400">Processing</span>
```

## Breakpoints (Responsive Design)

```tsx
// Tailwind responsive classes
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {/* Responsive grid */}
</div>

// Via tokens
import { tokens, getBreakpoint } from '@/theme/tokens';

const md = tokens.breakpoints.md; // '768px'
const query = `@media (min-width: ${getBreakpoint('md')})`;
```

## Color Palette Reference

### Semantic Colors
```
Primary (Blue):      #0284c7 (light) → #0ea5e9 (dark)
Success (Green):     #16a34a (light) → #22c55e (dark)
Warning (Amber):     #d97706 (light) → #fbbf24 (dark)
Error (Red):         #dc2626 (light) → #ef4444 (dark)
Info (Blue):         #2563eb (light) → #3b82f6 (dark)
Neutral (Gray):      #f9fafb to #030712 (scale)
```

### Color Scale
Each semantic color has:
- 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 variants
- Plus light/dark mode specific variants

## Best Practices

### Do's ✓
- Always use semantic colors for UI states (success, error, warning, info)
- Apply dark mode classes to all components
- Use tokens for consistent spacing and sizing
- Use utility functions from tokens module
- Keep colors semantic and meaningful
- Test components in both light and dark modes

### Don'ts ✗
- Don't hardcode colors in components
- Don't use arbitrary Tailwind colors without semantic meaning
- Don't forget dark mode variants
- Don't mix design tokens with hardcoded values
- Don't create new color values outside the design system
- Don't ignore contrast ratios in dark mode

## TypeScript Support

```tsx
import type { Spacing, Radius, Shadow, ZIndex } from '@/theme/tokens';
import type { ToastType } from '@/components/Toast';

function myComponent(spacing: Spacing, shadow: Shadow) {
  // Full type safety
}
```

## File Organization

```
src/
├── components/
│   └── providers/
│       └── ThemeProvider.tsx
├── theme/
│   ├── colors.ts      // Semantic colors and status mappings
│   ├── tokens.ts      // Design tokens and utilities
│   └── icons.tsx      // Icon definitions
└── app/
    └── globals.css    // CSS variables
```

## Migration Guide

### Old Way (Before Phase 2)
```tsx
<div className="bg-white p-4 rounded-lg shadow-md border border-gray-300">
  <p className="text-gray-900">Text</p>
  <button className="bg-blue-600 hover:bg-blue-700 text-white">
    Action
  </button>
</div>
```

### New Way (Phase 2+)
```tsx
<div className="bg-white dark:bg-gray-900 p-lg rounded-md shadow-md dark:shadow-lg border border-gray-300 dark:border-gray-700">
  <p className="text-gray-900 dark:text-gray-50">Text</p>
  <button className="bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600 text-white">
    Action
  </button>
</div>
```

## Resources

- Design System: `./PHASE_2_IMPLEMENTATION_SUMMARY.md`
- Tailwind Config: `./tailwind.config.js`
- Semantic Colors: `./src/theme/colors.ts`
- Design Tokens: `./src/theme/tokens.ts`
- Theme Provider: `./src/components/providers/ThemeProvider.tsx`
