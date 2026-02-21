'use client';

import { useCallback, useState } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onClearError?: () => void;
  validate?: (value: string) => string | null;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'numeric' | 'decimal' | 'none';
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  tooltip?: string;
  children?: React.ReactNode;
}

export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error: externalError,
  onClearError,
  validate,
  placeholder,
  autoComplete,
  inputMode,
  enterKeyHint,
  tooltip,
  children,
}: FormFieldProps) {
  const [blurError, setBlurError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const error = externalError || blurError;
  const isValid = touched && !error && value.length > 0;

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validate && value) {
      const err = validate(value);
      setBlurError(err);
    }
  }, [validate, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      if (blurError && validate) {
        const err = validate(e.target.value);
        if (!err) setBlurError(null);
      }
      if (externalError) onClearError?.();
    },
    [onChange, blurError, validate, externalError, onClearError]
  );

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label
          htmlFor={id}
          className="block text-[13px] font-semibold text-[var(--foreground-secondary)]"
        >
          {label}
        </label>
        {tooltip && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] text-[10px] text-[var(--foreground-tertiary)] cursor-help"
            title={tooltip}
          >
            ?
          </span>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200 ${
            error
              ? 'border-[var(--error)] focus:ring-[var(--error)]'
              : isValid
                ? 'border-[var(--success)] focus:ring-[var(--primary)]'
                : 'border-[var(--border)] focus:ring-[var(--primary)] hover:border-[var(--border-dark)]'
          }`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isValid && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--success)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
