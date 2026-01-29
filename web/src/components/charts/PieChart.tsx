'use client';

import React from 'react';
import {
  PieChart as RechartPieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { useTheme } from '@/lib/hooks/useTheme';
import { chartColorPalette, chartColorPaletteDark } from '@/theme/chartConfig';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: DataPoint[];
  dataKey?: string;
  nameKey?: string;
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabel?: boolean;
  className?: string;
}

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {payload[0].name}
        </p>
        <p className="text-sm" style={{ color: payload[0].fill }}>
          Value: {payload[0].value}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {((payload[0].value as number) / 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export const PieChart: React.FC<PieChartProps> = ({
  data,
  dataKey = 'value',
  nameKey = 'name',
  height = 300,
  showLegend = true,
  showTooltip = true,
  showLabel = true,
  className,
}) => {
  const { isDark } = useTheme();
  const palette = isDark ? chartColorPaletteDark : chartColorPalette;

  const colors = data.map((item, index) => item.color || palette[index % palette.length]);

  return (
    <div className={`flex justify-center w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={
              showLabel
                ? {
                    position: 'outside' as const,
                    formatter: (value: number) => `${value}%`,
                  }
                : false
            }
            isAnimationActive={true}
          >
            {colors.map((color, index) => (
              <Cell key={`cell-${index}`} fill={color} />
            ))}
          </Pie>
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && <Legend />}
        </RechartPieChart>
      </ResponsiveContainer>
    </div>
  );
};
