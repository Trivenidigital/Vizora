'use client';

import React from 'react';
import {
  LineChart as RechartLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { useTheme } from '@/lib/hooks/useTheme';
import { getChartTheme, chartColorPalette, chartColorPaletteDark } from '@/theme/chartConfig';

interface DataPoint {
  [key: string]: string | number;
}

interface LineChartProps {
  data: DataPoint[];
  dataKeys: Array<{
    key: string;
    name: string;
    color?: string;
    strokeWidth?: number;
  }>;
  xAxisKey: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  smooth?: boolean;
  className?: string;
}

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {label}
        </p>
        {/* The series colour moves to the SWATCH and the words take the ink.
            The series palette is sized for graphical objects at SC 1.4.11's 3:1,
            which is right for a line or a swatch; as TEXT on the tooltip's own
            `--surface` fill two of the eight are under AA - brass 3.10:1 and coral
            3.32:1. globals.css already makes this exact correction for the legend
            LABEL (`.recharts-legend-item-text`), and this is the same defect on a
            tooltip row we render ourselves, so no global rule reaches it. The swatch
            keeps the hue at 3:1, which all eight clear, and the words read at
            14.83:1. */}
        {payload.map((entry, index) => (
          <p
            key={`item-${index}`}
            className="flex items-center gap-1.5 text-sm text-[var(--foreground)]"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const LineChart: React.FC<LineChartProps> = ({
  data,
  dataKeys,
  xAxisKey,
  yAxisLabel,
  xAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  smooth = true,
  className,
}) => {
  const { isDark } = useTheme();
  const theme = getChartTheme(isDark ? 'dark' : 'light');
  const palette = isDark ? chartColorPaletteDark : chartColorPalette;

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartLineChart data={data} margin={theme.colors as any}>
          {showGrid && <CartesianGrid {...theme.cartesianGrid} />}
          {/* `fill` on the axis TITLE, not just the ticks: recharts' `<Label>` builds
            * its own `<Text>`, which falls back to recharts' DEFAULT_FILL grey
            * (3.82:1 on the card) when no fill is given. See `AreaChart.tsx`. */}
          <XAxis
            dataKey={xAxisKey}
            stroke={theme.colors.gridStroke}
            style={{ fontSize: '12px', fill: theme.colors.text }}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: 'insideBottomRight',
                    offset: -5,
                    fill: theme.colors.text,
                  }
                : undefined
            }
          />
          <YAxis
            stroke={theme.colors.gridStroke}
            style={{ fontSize: '12px', fill: theme.colors.text }}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    fill: theme.colors.text,
                  }
                : undefined
            }
          />
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && <Legend />}
          {dataKeys.map((item, index) => (
            <Line
              key={item.key}
              type={smooth ? 'monotone' : 'linear'}
              dataKey={item.key}
              name={item.name}
              stroke={item.color || palette[index % palette.length]}
              strokeWidth={item.strokeWidth || 2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
            />
          ))}
        </RechartLineChart>
      </ResponsiveContainer>
    </div>
  );
};
