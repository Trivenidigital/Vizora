'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TextPropertiesProps {
  elementId: string;
  textContent: string;
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

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Playfair Display', value: '"Playfair Display", serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
];

const FONT_WEIGHTS = [
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi-Bold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '900' },
];

const ALIGNMENTS = [
  { label: 'L', value: 'left' },
  { label: 'C', value: 'center' },
  { label: 'R', value: 'right' },
  { label: 'J', value: 'justify' },
];

export default function TextProperties({
  elementId,
  textContent,
  styles,
  onPropertyChange,
}: TextPropertiesProps) {
  const [localText, setLocalText] = useState(textContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPropagated = useRef(textContent);

  useEffect(() => {
    setLocalText(textContent);
    lastPropagated.current = textContent;
  }, [textContent]);

  const propagateText = useCallback(
    (value: string) => {
      if (value !== lastPropagated.current) {
        lastPropagated.current = value;
        onPropertyChange(elementId, 'textContent', textContent, value);
      }
    },
    [elementId, textContent, onPropertyChange],
  );

  // Debounced propagation as user types
  useEffect(() => {
    if (localText === lastPropagated.current) return;
    debounceRef.current = setTimeout(() => propagateText(localText), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localText, propagateText]);

  const fontSize = parseInt(styles.fontSize || '16', 10);
  const colorHex = rgbToHex(styles.color || '#ffffff');
  const currentAlign = styles.textAlign || 'left';

  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';
  const inputClass =
    'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="space-y-4">
      {/* Text Content */}
      <div>
        <label className={labelClass}>Text Content</label>
        <textarea
          rows={3}
          className={`${inputClass} resize-none`}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              propagateText(localText);
            }
          }}
          onBlur={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            propagateText(localText);
          }}
        />
      </div>

      {/* Font Family */}
      <div>
        <label className={labelClass}>Font Family</label>
        <select
          className={inputClass}
          value={styles.fontFamily || 'Inter, sans-serif'}
          onChange={(e) =>
            onPropertyChange(elementId, 'fontFamily', styles.fontFamily || '', e.target.value)
          }
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className={labelClass}>
          Font Size <span className="text-gray-500">{fontSize}px</span>
        </label>
        <input
          type="range"
          min={12}
          max={120}
          value={fontSize}
          className="w-full accent-emerald-500"
          onChange={(e) =>
            onPropertyChange(
              elementId,
              'fontSize',
              styles.fontSize || '16px',
              `${e.target.value}px`,
            )
          }
        />
      </div>

      {/* Font Weight */}
      <div>
        <label className={labelClass}>Font Weight</label>
        <select
          className={inputClass}
          value={styles.fontWeight || '400'}
          onChange={(e) =>
            onPropertyChange(elementId, 'fontWeight', styles.fontWeight || '400', e.target.value)
          }
        >
          {FONT_WEIGHTS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label} ({w.value})
            </option>
          ))}
        </select>
      </div>

      {/* Text Color */}
      <div>
        <label className={labelClass}>Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorHex}
            className="h-8 w-8 cursor-pointer rounded border border-gray-600 bg-transparent p-0"
            onChange={(e) =>
              onPropertyChange(elementId, 'color', styles.color || '', e.target.value)
            }
          />
          <span className="text-sm text-gray-300">{colorHex}</span>
        </div>
      </div>

      {/* Text Alignment */}
      <div>
        <label className={labelClass}>Text Alignment</label>
        <div className="flex gap-1">
          {ALIGNMENTS.map((a) => (
            <button
              key={a.value}
              className={`flex-1 rounded px-2 py-1.5 text-sm font-medium transition-colors ${
                currentAlign === a.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() =>
                onPropertyChange(elementId, 'textAlign', styles.textAlign || 'left', a.value)
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
