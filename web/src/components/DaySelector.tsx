'use client';

import { Icon } from '@/theme/icons';

interface DaySelectorProps {
  selected: string[];
  onChange: (days: string[]) => void;
  className?: string;
}

const DAYS = [
  { id: 'Monday', label: 'Mon', fullLabel: 'Monday' },
  { id: 'Tuesday', label: 'Tue', fullLabel: 'Tuesday' },
  { id: 'Wednesday', label: 'Wed', fullLabel: 'Wednesday' },
  { id: 'Thursday', label: 'Thu', fullLabel: 'Thursday' },
  { id: 'Friday', label: 'Fri', fullLabel: 'Friday' },
  { id: 'Saturday', label: 'Sat', fullLabel: 'Saturday' },
  { id: 'Sunday', label: 'Sun', fullLabel: 'Sunday' },
];

export default function DaySelector({
  selected,
  onChange,
  className = '',
}: DaySelectorProps) {
  const toggleDay = (dayId: string) => {
    if (selected.includes(dayId)) {
      onChange(selected.filter(d => d !== dayId));
    } else {
      onChange([...selected, dayId]);
    }
  };

  const toggleWeekdays = () => {
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const allWeekdaysSelected = weekdays.every(d => selected.includes(d));

    if (allWeekdaysSelected) {
      onChange(selected.filter(d => !weekdays.includes(d)));
    } else {
      const newSelected = new Set(selected);
      weekdays.forEach(d => newSelected.add(d));
      onChange(Array.from(newSelected));
    }
  };

  const toggleWeekends = () => {
    const weekends = ['Saturday', 'Sunday'];
    const allWeekendsSelected = weekends.every(d => selected.includes(d));

    if (allWeekendsSelected) {
      onChange(selected.filter(d => !weekends.includes(d)));
    } else {
      const newSelected = new Set(selected);
      weekends.forEach(d => newSelected.add(d));
      onChange(Array.from(newSelected));
    }
  };

  const toggleAll = () => {
    if (selected.length === 7) {
      onChange([]);
    } else {
      onChange(DAYS.map(d => d.id));
    }
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weekends = ['Saturday', 'Sunday'];
  const allWeekdaysSelected = weekdays.every(d => selected.includes(d));
  const allWeekendsSelected = weekends.every(d => selected.includes(d));

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Quick Select Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={toggleAll}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selected.length === 7
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Days
          </button>

          <button
            onClick={toggleWeekdays}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              allWeekdaysSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Weekdays
          </button>

          <button
            onClick={toggleWeekends}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              allWeekendsSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Weekends
          </button>
        </div>

        {/* Day Toggles */}
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map(day => {
            const isSelected = selected.includes(day.id);
            return (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`py-3 px-2 rounded-lg font-semibold text-sm transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={day.fullLabel}
              >
                {day.label}
              </button>
            );
          })}
        </div>

        {/* Selected Days Display */}
        {selected.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">{selected.length}</span> day{selected.length !== 1 ? 's' : ''} selected:{' '}
              {selected.map(d => DAYS.find(day => day.id === d)?.fullLabel).join(', ')}
            </p>
          </div>
        )}

        {selected.length === 0 && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              Please select at least one day
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
