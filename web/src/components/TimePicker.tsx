'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@/theme/icons';

interface TimePickerProps {
  value: string;  // HH:MM format (24-hour)
  onChange: (value: string) => void;
  interval?: number;  // 15, 30, 60 minutes
  showFormat?: '12h' | '24h';
  className?: string;
}

export default function TimePicker({
  value,
  onChange,
  interval = 15,
  showFormat = '24h',
  className = '',
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const [hours, minutes] = value.split(':').map(Number);

  // Generate time options based on interval
  const timeOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];

    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += interval) {
        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        let label: string;

        if (showFormat === '12h') {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
          label = `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
        } else {
          label = timeString;
        }

        options.push({ label, value: timeString });
      }
    }

    return options;
  }, [interval, showFormat]);

  // Get current display value
  const currentOption = timeOptions.find(opt => opt.value === value);
  const displayValue = currentOption?.label || value;

  // Common presets
  const presets = [
    { label: 'Start of Business (9:00 AM)', value: '09:00' },
    { label: 'Lunch Time (12:00 PM)', value: '12:00' },
    { label: 'End of Business (5:00 PM)', value: '17:00' },
    { label: 'Evening (7:00 PM)', value: '19:00' },
    { label: 'Midnight', value: '00:00' },
  ];

  return (
    <div className={className}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] flex items-center justify-between hover:border-[var(--foreground-tertiary)] transition-colors"
        >
          <span>{displayValue}</span>
          <Icon name="chevronDown" size="sm" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

            <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
              {/* Presets */}
              <div className="border-b border-[var(--border)] p-2">
                <div className="text-xs font-semibold text-[var(--foreground-tertiary)] px-2 py-1">
                  Common Times
                </div>
                {presets.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      onChange(preset.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      value === preset.value
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-semibold'
                        : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Time Options */}
              <div className="max-h-60 overflow-y-auto">
                {timeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      value === option.value
                        ? 'bg-[#00E5A0] text-[#061A21] font-semibold'
                        : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
