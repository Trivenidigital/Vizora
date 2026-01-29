'use client';

import React from 'react';
import {
  ComposedChart as RechartComposedChart,
  Bar,
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

interface SeriesConfig {
  type: 'line' | 'bar';
  key: string;
  name: string;
  color?: string;
  yAxisId?: 'left' | 'right';
  stackId?: string;
}

interface ComposedChartProps {
  data: DataPoint[];
  series: SeriesConfig[];
  xAxisKey: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  dualAxis?: boolean;
  className?: string;
}

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {label}
        </p>
        {payload.map((entry, index) => (
          <p
            key={`item-${index}`}
            className="text-sm"
            style={{ color: entry.color }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ComposedChart: React.FC<ComposedChartProps> = ({
  data,
  series,
  xAxisKey,
  yAxisLabel,
  xAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  dualAxis = false,
  className,
}) => {
  const { isDark } = useTheme();
  const theme = getChartTheme(isDark ? 'dark' : 'light');
  const palette = isDark ? chartColorPaletteDark : chartColorPalette;

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartComposedChart data={data} margin={theme.colors as any}>
          {showGrid && <CartesianGrid {...theme.cartesianGrid} />}
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
                  }
                : undefined
            }
          />
          <YAxis
            yAxisId="left"
            stroke={theme.colors.gridStroke}
            style={{ fontSize: '12px', fill: theme.colors.text }}
            label={
              yAxisLabel
                ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
                : undefined
            }
          />
          {dualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={theme.colors.gridStroke}
              style={{ fontSize: '12px', fill: theme.colors.text }}
            />
          )}
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && <Legend />}
          {series.map((item, index) => {
            const baseProps = {
              key: item.key,
              dataKey: item.key,
              name: item.name,
              yAxisId: item.yAxisId || 'left',
              fill: item.color || palette[index % palette.length],
              stroke: item.color || palette[index % palette.length],
            };

            if (item.type === 'bar') {
              return (
                <Bar
                  {...baseProps}
                  stackId={item.stackId}
                  radius={[8, 8, 0, 0]}
                />
              );
            }

            return (
              <Line
                {...baseProps}
                type="monotone"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            );
          })}
        </RechartComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
