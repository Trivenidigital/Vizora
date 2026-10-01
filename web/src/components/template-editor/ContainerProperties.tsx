'use client';

interface ContainerPropertiesProps {
  elementId: string;
  styles: Record<string, string>;
  onPropertyChange: (elementId: string, property: string, oldValue: string, newValue: string) => void;
}

/**
 * Convert browser-returned `rgb(r, g, b)` strings to `#rrggbb` hex.
 * Returns the input unchanged if it is not an rgb() value.
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!match) return rgb;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return (
    '#' +
    [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
  );
}

export default function ContainerProperties({
  elementId,
  styles,
  onPropertyChange,
}: ContainerPropertiesProps) {
  /*
   * NOT chrome — do not tokenise. This is the fallback handed to
   * `<input type="color">` for the CUSTOMER'S own design value when the
   * selected element carries none. Customer content (plan D4/D7).
   */
  const bgColorHex = rgbToHex(styles.backgroundColor || '#000000');
  const borderRadius = parseInt(styles.borderRadius || '0', 10);

  const labelClass = 'block text-xs font-medium text-[var(--foreground-tertiary)] mb-1';
  const inputClass =
    'w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary-ink)]';

  return (
    <div className="space-y-4">
      {/* Background Color */}
      <div>
        <label className={labelClass}>Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={bgColorHex}
            className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
            onChange={(e) =>
              onPropertyChange(
                elementId,
                'backgroundColor',
                styles.backgroundColor || '',
                e.target.value,
              )
            }
          />
          <span className="text-sm text-[var(--foreground-tertiary)]">{bgColorHex}</span>
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <label className={labelClass}>
          Border Radius <span className="text-[var(--foreground-tertiary)]">{borderRadius}px</span>
        </label>
        <input
          type="range"
          min={0}
          max={50}
          value={borderRadius}
          className="w-full accent-[var(--primary-ink)]"
          onChange={(e) =>
            onPropertyChange(
              elementId,
              'borderRadius',
              styles.borderRadius || '0px',
              `${e.target.value}px`,
            )
          }
        />
      </div>

      {/* Padding */}
      <div>
        <label className={labelClass}>Padding</label>
        <input
          type="text"
          className={inputClass}
          defaultValue={styles.padding || '0px'}
          placeholder="e.g. 16px or 16px 24px"
          onBlur={(e) => {
            const newValue = e.target.value.trim() || '0px';
            if (newValue !== (styles.padding || '0px')) {
              onPropertyChange(elementId, 'padding', styles.padding || '0px', newValue);
            }
          }}
        />
      </div>
    </div>
  );
}
