import { ShadowLogService } from './shadow-log.service';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ShadowLogService', () => {
  let tmpDir: string;
  let svc: ShadowLogService;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'shadow-log-test-'));
    process.env.HERMES_SHADOW_LOG_DIR = tmpDir;
    // Re-require to pick up the env var (BASE_DIR is computed at class-load).
    // Easier: force-set the static BASE_DIR for the test.
    (ShadowLogService as unknown as { BASE_DIR: string }).BASE_DIR = tmpDir;
    svc = new ShadowLogService();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes one valid JSONL line for an allowlisted log + valid fields', () => {
    const out = svc.appendRow('vizora-customer-lifecycle-shadow', {
      organization_id: 'o1',
      tier: 'pro',
      hermes_template: 'day3-upload-content',
    });
    expect(out.written).toBe(true);
    expect(out.lineCount).toBe(1);

    const filePath = join(tmpDir, 'vizora-customer-lifecycle-shadow.jsonl');
    const content = readFileSync(filePath, 'utf8');
    expect(content.endsWith('\n')).toBe(true);
    const row = JSON.parse(content.trim());
    expect(row.organization_id).toBe('o1');
    expect(row.tier).toBe('pro');
    expect(row.hermes_template).toBe('day3-upload-content');
  });

  it('SERVER-GENERATES timestamp and run_id (overrides whatever the agent supplies — discipline boundary)', () => {
    svc.appendRow('vizora-customer-lifecycle-shadow', {
      organization_id: 'o1',
      // Agent attempts to supply these — must be ignored:
      timestamp: '1999-01-01T00:00:00Z',
      run_id: '<unique-id>',
    });
    const filePath = join(tmpDir, 'vizora-customer-lifecycle-shadow.jsonl');
    const row = JSON.parse(readFileSync(filePath, 'utf8').trim());
    // Timestamp must be RIGHT NOW, not 1999
    expect(row.timestamp).not.toBe('1999-01-01T00:00:00Z');
    expect(new Date(row.timestamp).getTime()).toBeGreaterThan(
      new Date('2026-01-01').getTime(),
    );
    // run_id must be epoch-seconds string, not the placeholder
    expect(row.run_id).not.toBe('<unique-id>');
    expect(row.run_id).toMatch(/^\d{10}$/);
  });

  it('APPENDS, never truncates — multiple calls accumulate rows', () => {
    svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't1' });
    svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't2' });
    svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't3' });
    const filePath = join(tmpDir, 'vizora-support-triage-shadow.jsonl');
    const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).ticket_id).toBe('t1');
    expect(JSON.parse(lines[1]).ticket_id).toBe('t2');
    expect(JSON.parse(lines[2]).ticket_id).toBe('t3');
  });

  it('REJECTS unknown log names (allowlist enforcement — defense against path traversal)', () => {
    expect(() => svc.appendRow('not-an-allowlisted-log', { a: 1 })).toThrow(
      /allowlist/,
    );
    expect(() => svc.appendRow('../etc/passwd', { a: 1 })).toThrow(
      /allowlist/,
    );
    expect(() =>
      svc.appendRow('vizora-customer-lifecycle-shadow/../../../tmp/pwn', { a: 1 }),
    ).toThrow(/allowlist/);
  });

  it('REJECTS non-object fields (must be a JSON object, not array or primitive)', () => {
    expect(() =>
      svc.appendRow('vizora-support-triage-shadow', null as unknown as Record<string, unknown>),
    ).toThrow(/object/);
    expect(() =>
      svc.appendRow('vizora-support-triage-shadow', [1, 2, 3] as unknown as Record<string, unknown>),
    ).toThrow(/object/);
    expect(() =>
      svc.appendRow('vizora-support-triage-shadow', 'a string' as unknown as Record<string, unknown>),
    ).toThrow(/object/);
  });

  it('REJECTS rows that exceed PIPE_BUF (atomic-write guarantee)', () => {
    const huge = 'x'.repeat(5000);
    expect(() =>
      svc.appendRow('vizora-support-triage-shadow', { huge_field: huge }),
    ).toThrow(/atomic.*violated|max.*4096/i);
  });

  it('creates BASE_DIR if it does not exist', () => {
    rmSync(tmpDir, { recursive: true });
    expect(existsSync(tmpDir)).toBe(false);
    svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't1' });
    expect(existsSync(tmpDir)).toBe(true);
  });

  it('returns post-append line count for caller sanity', () => {
    const a = svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't1' });
    expect(a.lineCount).toBe(1);
    const b = svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't2' });
    expect(b.lineCount).toBe(2);
    const c = svc.appendRow('vizora-support-triage-shadow', { ticket_id: 't3' });
    expect(c.lineCount).toBe(3);
  });
});
