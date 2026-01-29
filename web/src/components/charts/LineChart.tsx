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
            stroke={theme.colors.gridStroke}
            style={{ fontSize: '12px', fill: theme.colors.text }}
            label={
              yAxisLabel
                ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
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
