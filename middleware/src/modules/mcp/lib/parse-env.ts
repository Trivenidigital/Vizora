/**
 * Parse a positive integer from an environment-variable value.
 *
 * The bare `Number(process.env.X ?? default)` pattern silently
 * disables downstream guards when an operator typos a value:
 * `Number("sixty")` → `NaN`, and `count >= NaN` is always `false`,
 * so a rate-limit check or TTL clamp turns into a no-op without any
 * log line. That is a security-control failure mode.
 *
 * This helper:
 *   - Returns the fallback if `value` is undefined / empty
 *   - Parses as integer (rejects floats and trailing junk)
 *   - Returns the fallback + writes a `console.warn` line if the
 *     parse fails or the value is non-positive
 *   - Always returns a finite positive integer
 *
 * Use at module load time. Don't repeat the parse on every call —
 * fail fast (or fall back fast) on startup so misconfiguration is
 * obvious in the boot logs.
 */
export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  varName: string,
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  // Reject floats / trailing junk: '60' OK, '60.5' / '60abc' NOT OK
  if (!/^\d+$/.test(value.trim())) {
    // eslint-disable-next-line no-console
    console.warn(
      `[parse-env] ${varName}='${value}' is not a positive integer; falling back to ${fallback}`,
    );
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[parse-env] ${varName}='${value}' parsed to ${parsed}; falling back to ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}
