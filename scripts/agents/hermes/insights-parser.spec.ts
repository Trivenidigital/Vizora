/**
 * Unit tests for the hermes insights parser. Synthetic fixtures cover:
 *   - the empty-case literal string from prod (verified live 2026-05-08)
 *   - typical Unicode-box-table output
 *   - format-drift cases (raise InsightsParserError)
 *   - ragged rows / totals row / missing tokens
 *
 * Real prod output not used here — the parser is the contract; CI will
 * verify with a paid-key smoke test when credits are added.
 */

import {
  parseHermesInsightsTable,
  InsightsParserError,
} from './insights-parser';

describe('parseHermesInsightsTable', () => {
  it('returns [] for the prod-verified empty-case literal', () => {
    expect(parseHermesInsightsTable('No sessions found in the last 1 days (source: cli).')).toEqual(
      [],
    );
  });

  it('returns [] for completely empty input', () => {
    expect(parseHermesInsightsTable('')).toEqual([]);
  });

  it('parses a single-row Unicode-box table', () => {
    const fixture = `
┌─────────────────────┬──────────────────────────────────┬──────┬──────┐
│ time                │ model                            │ in   │ out  │
├─────────────────────┼──────────────────────────────────┼──────┼──────┤
│ 2026-05-08 12:30:00 │ openai/gpt-4o-mini-2024-07-18    │ 5000 │  800 │
└─────────────────────┴──────────────────────────────────┴──────┴──────┘
`;
    const rows = parseHermesInsightsTable(fixture);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: 'openai/gpt-4o-mini-2024-07-18',
      tokensIn: 5000,
      tokensOut: 800,
    });
    expect(rows[0].timestamp.toISOString()).toContain('2026-05-08');
  });

  it('parses multi-row tables and accepts ASCII-pipe variant', () => {
    // ASCII-pipe variant — some terminals emit │ as |.
    const fixture = [
      '+---------------------+--------------------+------+------+',
      '| time                | model              |   in |  out |',
      '+---------------------+--------------------+------+------+',
      '| 2026-05-08 12:30:00 | openai/gpt-4o-mini | 5000 |  800 |',
      '| 2026-05-08 12:35:00 | openai/gpt-4o-mini |  500 |  150 |',
      '+---------------------+--------------------+------+------+',
    ].join('\n');
    const rows = parseHermesInsightsTable(fixture);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.tokensIn)).toEqual([5000, 500]);
  });

  it('honors a skill column when present', () => {
    const fixture = `
┌─────────────────────┬──────────────────────────┬─────────────────────────────┬──────┬──────┐
│ time                │ skill                    │ model                       │ in   │ out  │
├─────────────────────┼──────────────────────────┼─────────────────────────────┼──────┼──────┤
│ 2026-05-08 12:30:00 │ vizora-customer-lifecycle│ openai/gpt-4o-mini          │ 4200 │  380 │
└─────────────────────┴──────────────────────────┴─────────────────────────────┴──────┴──────┘
`;
    const rows = parseHermesInsightsTable(fixture);
    expect(rows[0].skillNameHint).toBe('vizora-customer-lifecycle');
  });

  it('strips comma-formatted token counts (e.g. "4,200")', () => {
    const fixture = `
┌─────────────────────┬─────────────────────┬───────┬───────┐
│ time                │ model               │ in    │ out   │
├─────────────────────┼─────────────────────┼───────┼───────┤
│ 2026-05-08 12:30:00 │ openai/gpt-4o-mini  │ 4,200 │ 1,200 │
└─────────────────────┴─────────────────────┴───────┴───────┘
`;
    const rows = parseHermesInsightsTable(fixture);
    expect(rows[0].tokensIn).toBe(4200);
    expect(rows[0].tokensOut).toBe(1200);
  });

  it('skips rows where token columns are not parseable (e.g. totals row)', () => {
    const fixture = `
┌─────────────────────┬─────────────────────┬───────┬───────┐
│ time                │ model               │ in    │ out   │
├─────────────────────┼─────────────────────┼───────┼───────┤
│ 2026-05-08 12:30:00 │ openai/gpt-4o-mini  │ 4,200 │ 1,200 │
│ TOTAL               │ -                   │ 4,200 │ 1,200 │
└─────────────────────┴─────────────────────┴───────┴───────┘
`;
    const rows = parseHermesInsightsTable(fixture);
    // The TOTAL row has no parseable timestamp → skipped.
    expect(rows).toHaveLength(1);
  });

  it('throws InsightsParserError when output is non-empty but no parseable rows', () => {
    expect(() => parseHermesInsightsTable('something completely different\nno table here')).toThrow(
      InsightsParserError,
    );
  });

  it('throws InsightsParserError when required header columns are missing (format drift)', () => {
    const fixture = `
┌─────────────────────┬──────────────────────────┐
│ time                │ totally-unknown-column   │
├─────────────────────┼──────────────────────────┤
│ 2026-05-08 12:30:00 │ x                        │
└─────────────────────┴──────────────────────────┘
`;
    expect(() => parseHermesInsightsTable(fixture)).toThrow(InsightsParserError);
  });

  it('preserves raw output in the error for debugging', () => {
    const drift = 'unrecognized output\nshape changed across versions';
    try {
      parseHermesInsightsTable(drift);
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InsightsParserError);
      expect((err as InsightsParserError).rawOutput).toBe(drift);
    }
  });
});
