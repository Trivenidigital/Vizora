'use client';

interface QuotaBarProps {
  used: number;
  total: number;
  label?: string;
}

export function QuotaBar({ used, total, label }: QuotaBarProps) {
  const safeUsed = Number(used) || 0;
  const safeTotal = Number(total) || 0;
  const percentage = safeTotal > 0 ? Math.min((safeUsed / safeTotal) * 100, 100) : 0;

  /*
   * The three tones are a SEMANTIC ladder -- normal / approaching the quota /
   * at it -- so they take the status tokens rather than palette shades. The
   * hue is the information here: a user reads "am I about to run out" from the
   * colour before they read the number, which is why these are not brand tints.
   */
  let barColor = 'bg-brand';
  if (percentage >= 90) {
    barColor = 'bg-error';
  } else if (percentage >= 75) {
    barColor = 'bg-warning';
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--foreground-secondary)]">{label}</span>
          <span className="font-medium text-[var(--foreground)]">
            {safeUsed} / {safeTotal} screens
          </span>
        </div>
      )}
      <div className="w-full h-3 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--foreground-tertiary)]">
        <span>{percentage.toFixed(0)}% used</span>
        <span>{safeTotal - safeUsed} remaining</span>
      </div>
    </div>
  );
}
