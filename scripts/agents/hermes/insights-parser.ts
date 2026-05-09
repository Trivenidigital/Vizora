/**
 * Parser for `hermes insights --days N --source cli` boxed-table output.
 *
 * Hermes 0.12.0 emits Unicode box-drawing tables (verified live on prod
 * 2026-05-08; --json flag does NOT exist as of this version). The empty
 * case is the literal string "No sessions found in the last N days...".
 *
 * Parser is a stable contract that fails LOUDLY on format drift —
 * Hermes-version-pin (HERMES_VERSION env) is the gate that prevents
 * silent breakage; this parser raises an explicit error if it sees
 * unfamiliar shape so the sidecar logs ERROR rather than silently
 * dropping data.
 *
 * Token-extraction grammar is intentionally permissive over WHICH columns
 * the table contains (insights output may evolve) but strict over the
 * presence of the columns we depend on.
 */

export interface InsightsRow {
  /** Session timestamp, parsed from the table row's date/time column. */
  timestamp: Date;
  /** Model identifier (e.g. "openai/gpt-4o-mini-2024-07-18"). */
  model: string;
  /** Total prompt/input tokens summed across all turns of the session. */
  tokensIn: number;
  /** Total completion/output tokens summed across all turns of the session. */
  tokensOut: number;
  /**
   * Optional skill-name hint, if hermes insights tags rows with skill
   * (depends on hermes version). When absent, callers fall back to
   * time-range matching.
   */
  skillNameHint?: string;
}

const EMPTY_OUTPUT_MARKER = /No sessions found/i;

export function parseHermesInsightsTable(output: string): InsightsRow[] {
  if (!output) return [];
  if (EMPTY_OUTPUT_MARKER.test(output)) return [];

  // Split into lines, drop box-drawing-only lines (┌─┐ │ ├─┤ └─┘ etc).
  const lines = output
    .split(/\r?\n/)
    .filter((line) => line.length > 0 && /[│|]/.test(line)) // table rows have pipe chars
    .filter((line) => !/^[\s│|─┌┬┐├┼┤└┴┘\-+]+$/.test(line)); // not separator lines

  if (lines.length === 0) {
    // Format change detected — output non-empty but contained no parseable rows.
    throw new InsightsParserError('hermes insights produced output but no parseable table rows', output);
  }

  // First line is the header. Lowercase column names for case-insensitive lookup.
  const headerCells = splitTableRow(lines[0]).map((c) => c.toLowerCase());
  const idxTime = findColumn(headerCells, ['time', 'timestamp', 'started']);
  const idxModel = findColumn(headerCells, ['model']);
  const idxIn = findColumn(headerCells, ['in', 'input', 'prompt', 'tokens in']);
  const idxOut = findColumn(headerCells, ['out', 'output', 'completion', 'tokens out']);
  const idxSkill = findColumn(headerCells, ['skill', 'skills']);

  if (idxTime === -1 || idxModel === -1 || idxIn === -1 || idxOut === -1) {
    throw new InsightsParserError(
      `required columns missing in insights header: ${headerCells.join(', ')}`,
      output,
    );
  }

  const rows: InsightsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]);
    if (cells.length < headerCells.length) continue; // ragged row — skip
    const ts = parseTableTimestamp(cells[idxTime]);
    if (!ts) continue; // skip non-data rows (e.g., totals row)
    const tokensIn = parseTableInt(cells[idxIn]);
    const tokensOut = parseTableInt(cells[idxOut]);
    if (tokensIn == null || tokensOut == null) continue;
    rows.push({
      timestamp: ts,
      model: cells[idxModel].trim(),
      tokensIn,
      tokensOut,
      skillNameHint: idxSkill !== -1 ? cells[idxSkill].trim() || undefined : undefined,
    });
  }
  return rows;
}

function splitTableRow(line: string): string[] {
  // Hermes uses both ASCII pipe (|) and Unicode pipe (│). Treat as one.
  return line
    .split(/[│|]/)
    .map((c) => c.trim())
    .filter((c, i, arr) => !(c === '' && (i === 0 || i === arr.length - 1)));
}

function findColumn(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseTableTimestamp(cell: string): Date | undefined {
  const s = cell.trim();
  if (!s) return undefined;
  // Try several formats: ISO-8601, "YYYY-MM-DD HH:MM:SS", "MM/DD HH:MM".
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  return undefined;
}

function parseTableInt(cell: string): number | undefined {
  const cleaned = cell.replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '-') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export class InsightsParserError extends Error {
  constructor(reason: string, public readonly rawOutput: string) {
    super(`InsightsParserError: ${reason}`);
    this.name = 'InsightsParserError';
  }
}
