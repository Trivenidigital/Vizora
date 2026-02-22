'use client';

import { useRef, useState } from 'react';

interface ImagePropertiesProps {
  elementId: string;
  src: string;
  styles: Record<string, string>;
  onPropertyChange: (elementId: string, property: string, oldValue: string, newValue: string) => void;
  onImageUpload: (file: File) => Promise<string>;
}

const OBJECT_FIT_OPTIONS = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
  { label: 'Fill', value: 'fill' },
  { label: 'None', value: 'none' },
];

export default function ImageProperties({
  elementId,
  src,
  styles,
  onPropertyChange,
  onImageUpload,
}: ImagePropertiesProps) {
  const [localSrc, setLocalSrc] = useState(src);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const borderRadius = parseInt(styles.borderRadius || '0', 10);

  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';
  const inputClass =
    'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await onImageUpload(file);
      setLocalSrc(url);
      onPropertyChange(elementId, 'src', src, url);
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      {src && (
        <div>
          <label className={labelClass}>Preview</label>
          <img
            src={src}
            alt="Element preview"
            className="h-24 w-full rounded border border-gray-600 object-cover"
          />
        </div>
      )}

      {/* Upload */}
      <div>
        <label className={labelClass}>Upload Image</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-50"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>
      </div>

      {/* URL Input */}
      <div>
        <label className={labelClass}>Image URL</label>
        <input
          type="text"
          className={inputClass}
          value={localSrc}
          onChange={(e) => setLocalSrc(e.target.value)}
          onBlur={() => {
            if (localSrc !== src) {
              onPropertyChange(elementId, 'src', src, localSrc);
            }
          }}
          placeholder="https://..."
        />
      </div>

      {/* Object Fit */}
      <div>
        <label className={labelClass}>Object Fit</label>
        <select
          className={inputClass}
          value={styles.objectFit || 'cover'}
          onChange={(e) =>
            onPropertyChange(elementId, 'objectFit', styles.objectFit || 'cover', e.target.value)
          }
        >
          {OBJECT_FIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Border Radius */}
      <div>
        <label className={labelClass}>
          Border Radius <span className="text-gray-500">{borderRadius}px</span>
        </label>
        <input
          type="range"
          min={0}
          max={50}
          value={borderRadius}
          className="w-full accent-emerald-500"
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
    </div>
  );
}
