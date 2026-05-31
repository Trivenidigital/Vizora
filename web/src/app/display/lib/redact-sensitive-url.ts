export function redactSensitiveUrl(value: string): string {
  if (!value) return value;
  return value.replace(/([?&]token=)[^&#\s)]+/gi, '$1[redacted]');
}
