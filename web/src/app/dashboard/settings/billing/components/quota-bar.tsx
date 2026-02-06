'use client';

interface QuotaBarProps {
  used: number;
  total: number;
  label?: string;
}

export function QuotaBar({ used, total, label }: QuotaBarProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  // Determine color based on usage
  let barColor = 'bg-blue-600 dark:bg-blue-500';
  if (percentage >= 90) {
    barColor = 'bg-red-600 dark:bg-red-500';
  } else if (percentage >= 75) {
    barColor = 'bg-yellow-600 dark:bg-yellow-500';
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {used} / {total} screens
          </span>
        </div>
      )}
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{percentage.toFixed(0)}% used</span>
        <span>{total - used} remaining</span>
      </div>
    </div>
  );
}
