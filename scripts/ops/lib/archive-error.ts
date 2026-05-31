export type ArchiveResult =
  | { kind: 'already_archived' }
  | { kind: 'not_found' }
  | { kind: 'fatal'; status: number; message: string }
  | { kind: 'transient'; status: number | null; message: string };

export function classifyArchiveError(err: unknown): ArchiveResult {
  const message = err instanceof Error ? err.message : String(err);
  const statusMatch = message.match(/^API (\d+):/);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status === 409) return { kind: 'already_archived' };
  if (status === 404) {
    if (/cannot\s+post/i.test(message)) {
      return { kind: 'fatal', status, message };
    }
    return { kind: 'not_found' };
  }
  if (status === 405) {
    return { kind: 'fatal', status, message };
  }

  return { kind: 'transient', status, message };
}
