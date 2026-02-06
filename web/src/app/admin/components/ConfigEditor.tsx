'use client';

import { useState } from 'react';
import { Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import type { SystemConfig } from '@/lib/types';

interface ConfigEditorProps {
  config: SystemConfig;
  onSave: (key: string, value: any) => Promise<void>;
  isLoading?: boolean;
}

export function ConfigEditor({ config, onSave, isLoading = false }: ConfigEditorProps) {
  const [value, setValue] = useState<string>(
    typeof config.value === 'object' ? JSON.stringify(config.value, null, 2) : String(config.value)
  );
  const [showSecret, setShowSecret] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setHasChanges(true);
    setError(null);
  };

  const handleSave = async () => {
    try {
      let parsedValue: any = value;

      // Parse based on data type
      if (config.dataType === 'number') {
        parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          setError('Invalid number');
          return;
        }
      } else if (config.dataType === 'boolean') {
        parsedValue = value.toLowerCase() === 'true';
      } else if (config.dataType === 'json') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          setError('Invalid JSON');
          return;
        }
      }

      await onSave(config.key, parsedValue);
      setHasChanges(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    }
  };

  const handleReset = () => {
    setValue(
      typeof config.value === 'object' ? JSON.stringify(config.value, null, 2) : String(config.value)
    );
    setHasChanges(false);
    setError(null);
  };

  const renderInput = () => {
    if (config.isSecret && !showSecret) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value="************************"
            disabled
            className="flex-1 px-3 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground-tertiary)]"
          />
          <button
            onClick={() => setShowSecret(true)}
            className="p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
            title="Show value"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      );
    }

    if (config.dataType === 'boolean') {
      return (
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if (config.dataType === 'json') {
      return (
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent font-mono text-sm"
        />
      );
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type={config.dataType === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        />
        {config.isSecret && (
          <button
            onClick={() => setShowSecret(false)}
            className="p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
            title="Hide value"
          >
            <EyeOff className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-[var(--foreground)]">{config.key}</h4>
          {config.description && (
            <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5">{config.description}</p>
          )}
        </div>
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--background-secondary)] text-[var(--foreground-secondary)]">
          {config.dataType}
        </span>
      </div>

      <div className="mt-3">{renderInput()}</div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {hasChanges && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
