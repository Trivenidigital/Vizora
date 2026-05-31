export function redactSensitiveUrl(value: string): string {
  if (!value) return value;
  return value.replace(/([?&]token=)[^&#\s)]+/gi, '$1[redacted]');
}

export function redactSensitiveTokens<T>(value: T): T {
  if (typeof value === 'string') {
    return redactSensitiveUrl(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveTokens(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactSensitiveTokens(entry),
      ]),
    ) as T;
  }

  return value;
}
