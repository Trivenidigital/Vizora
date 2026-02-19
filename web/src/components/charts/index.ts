import dynamic from 'next/dynamic';

// Lazy load all chart components to keep recharts (~200KB) out of the initial bundle.
// Charts are only used on the analytics page.

export const LineChart = dynamic(
  () => import('./LineChart').then((mod) => ({ default: mod.LineChart })),
  { ssr: false },
);

export const BarChart = dynamic(
  () => import('./BarChart').then((mod) => ({ default: mod.BarChart })),
  { ssr: false },
);

export const PieChart = dynamic(
  () => import('./PieChart').then((mod) => ({ default: mod.PieChart })),
  { ssr: false },
);

export const AreaChart = dynamic(
  () => import('./AreaChart').then((mod) => ({ default: mod.AreaChart })),
  { ssr: false },
);

export const ComposedChart = dynamic(
  () => import('./ComposedChart').then((mod) => ({ default: mod.ComposedChart })),
  { ssr: false },
);
