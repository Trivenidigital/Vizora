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
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {payload[0].name}
        </p>
        {/* The slice colour moves to the SWATCH and the words take the ink - the same
            correction globals.css already makes for the legend LABEL, on a tooltip row
            we render ourselves so no global rule reaches it. As text on the tooltip's
            `--surface` fill the slice colours run 3.10:1 to 10.79:1, so the palette's
            lower half fails AA; a swatch is a graphical object at the 3:1 bar, which
            all of them clear. */}
        <p className="flex items-center gap-1.5 text-sm text-[var(--foreground)]">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: payload[0].fill }}
          />
          Value: {payload[0].value}
        </p>
        <p className="text-xs text-[var(--foreground-tertiary)]">
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

  /*
   * THE LABELS ARE RE-INKED HERE, not at the `<Pie>`, and they are a TOKEN.
   *
   * recharts draws a pie label by spreading the SECTOR's props onto its `<Text>`,
   * so the label inherits the slice's `fill` and is painted in the slice colour —
   * and `renderLabels` puts it at `outerRadius + 20`, i.e. OUTSIDE the pie, on the
   * card. So a fill was being used as text against a ground it was never measured
   * against. On `--surface` the five statuses the server sends measured 2.08:1 to
   * 4.67:1; only `offline` cleared AA, and only because mid-grey happens to be
   * dark enough. `--foreground` is 14.83:1 and is the same register the other four
   * wrappers already use for their axis ticks (`chartColors.*.text`).
   *
   * Why a CSS class rather than `theme.colors.text` the way the axis ticks do it:
   * recharts puts `fill` on `<text>` as a PRESENTATION ATTRIBUTE, which any author
   * CSS declaration outranks — and `fill: var(--token)` resolves in a declaration
   * even though it cannot in an attribute. That is exactly the constraint
   * `chartConfig.ts` records, so this is the one chart colour that does NOT have
   * to be a literal. Series colours still do.
   *
   * The leader lines keep the slice fill deliberately: three of the five are under
   * 3:1 against the card, but they are decorative connectors whose meaning is
   * carried by position, and they are what ties a now-neutral label back to its
   * slice.
   */
  return (
    <div
      className={`flex justify-center w-full [&_.recharts-pie-label-text]:fill-[var(--foreground)] ${className || ''}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <RechartPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={showLabel ? ({ value }: { value: number }) => `${value}%` : false}
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
