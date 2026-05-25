import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Lazy load all chart components to keep recharts (~200KB) out of the initial bundle.
// Charts are only used on the analytics page.
//
// Explicit `ComponentType<any>` annotation: without it, `tsc --noEmit`
// fails with TS2742/TS4023 because next/dynamic returns a type that
// references React types from the underlying chart component, and
// those Props interfaces aren't exported. pnpm's nested module path
// for @types/react then can't be named. The any-typed annotation
// short-circuits the inference — callers pass component-specific
// props that recharts type-checks at the call site anyway.
export const LineChart: ComponentType<any> = dynamic(
  () => import('./LineChart').then((mod) => ({ default: mod.LineChart })),
  { ssr: false },
);

export const BarChart: ComponentType<any> = dynamic(
  () => import('./BarChart').then((mod) => ({ default: mod.BarChart })),
  { ssr: false },
);

export const PieChart: ComponentType<any> = dynamic(
  () => import('./PieChart').then((mod) => ({ default: mod.PieChart })),
  { ssr: false },
);

export const AreaChart: ComponentType<any> = dynamic(
  () => import('./AreaChart').then((mod) => ({ default: mod.AreaChart })),
  { ssr: false },
);

export const ComposedChart: ComponentType<any> = dynamic(
  () => import('./ComposedChart').then((mod) => ({ default: mod.ComposedChart })),
  { ssr: false },
);
