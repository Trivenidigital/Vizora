import { AgentStateService } from './agent-state.service';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync,
  openSync, closeSync, utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('AgentStateService', () => {
  let service: AgentStateService;
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'agent-state-test-'));
    service = new AgentStateService();
    (service as unknown as { stateDir: string }).stateDir = stateDir;
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  // Every test fixture is wrapped in a valid AgentFamilyState envelope so
  // the Zod validation in readFamilyFile() doesn't reject these synthetic
  // payloads. Tests that want to verify sanitization on a specific key
  // simply pass that key in `extras` — the .passthrough() schema lets
  // arbitrary additional fields through.
  const baseEnvelope = (): Record<string, unknown> => ({
    systemStatus: 'HEALTHY',
    lastUpdated: '2026-05-03T12:00:00.000Z',
    lastRun: {},
    incidents: [],
    recentRemediations: [],
    agentResults: {},
  });
  const write = (family: string, extras: Record<string, unknown> = {}) => {
    writeFileSync(
      join(stateDir, `${family}.json`),
      JSON.stringify({ ...baseEnvelope(), ...extras }),
    );
  };

  describe('sanitize / FORBIDDEN_KEY_REGEX (D9 + R2 + R4-HIGH1 anchored)', () => {
    // R4-HIGH1: the regex is now anchored (`^...$/i`) so only EXACT matches
    // to the allowlist are redacted. Variants like `apiToken`, `clientSecret`,
    // or bare `key` are intentionally NOT redacted — they were false-positive
    // substring matches in the old unanchored regex.
    it.each([
      'token',
      'secret',
      'apiKey',
      'password',
      'webhook',
      'jwt',
      'credential',
      'authHeader',
      'cookie',
      'sessionId',
      'privateKey',
      'accessToken',
    ])('redacts key matching %s', async (key) => {
      write('customer', { [key]: 'sensitive-value', safe: 'ok' });
      const result = (await service.read('customer-lifecycle')) as Record<string, unknown>;
      expect(result[key]).toBe('[REDACTED]');
      expect(result.safe).toBe('ok');
    });

    it.each(['apiToken', 'clientSecret', 'key', 'authorType', 'monkey'])(
      'does NOT redact non-allowlisted key %s (anchored regex)',
      async (key) => {
        write('customer', { [key]: 'harmless', safe: 'ok' });
        const result = (await service.read('customer-lifecycle')) as Record<string, unknown>;
        expect(result[key]).toBe('harmless');
      },
    );

    it('redacts recursively inside nested objects', async () => {
      write('customer', {
        nested: { deeper: { apiKey: 'hidden' }, normal: 'visible' },
      });
      const result = (await service.read('customer-lifecycle')) as {
        nested: { deeper: { apiKey: string }; normal: string };
      };
      expect(result.nested.deeper.apiKey).toBe('[REDACTED]');
      expect(result.nested.normal).toBe('visible');
    });

    it('redacts forbidden keys inside arrays of objects', async () => {
      write('customer', { items: [{ secret: 'a' }, { secret: 'b' }, { ok: 'c' }] });
      const result = (await service.read('customer-lifecycle')) as {
        items: Array<Record<string, unknown>>;
      };
      expect(result.items[0].secret).toBe('[REDACTED]');
      expect(result.items[1].secret).toBe('[REDACTED]');
      expect(result.items[2].ok).toBe('c');
    });

    it('leaves primitive values untouched', async () => {
      write('customer', { count: 42, ratio: 0.5, enabled: true, note: 'hello' });
      const result = (await service.read('customer-lifecycle')) as Record<string, unknown>;
      expect(result.count).toBe(42);
      expect(result.ratio).toBe(0.5);
      expect(result.enabled).toBe(true);
      expect(result.note).toBe('hello');
    });
  });

  describe('read()', () => {
    it('returns null for unknown agent name', async () => {
      await expect(service.read('nonexistent-agent')).resolves.toBeNull();
    });

    it('returns null when the family file does not exist', async () => {
      await expect(service.read('customer-lifecycle')).resolves.toBeNull();
    });

    it('preserves malformed JSON out-of-band and returns a corruption sentinel (R4-MED7)', async () => {
      writeFileSync(join(stateDir, 'customer.json'), 'not-json{');
      const result = (await service.read('customer-lifecycle')) as {
        __error: string;
        family: string;
        preservedAs: string;
      } | null;
      expect(result).not.toBeNull();
      expect(result!.__error).toBe('state file corrupt');
      expect(result!.family).toBe('customer');
      // Backup file exists, original is gone.
      expect(existsSync(join(stateDir, 'customer.json'))).toBe(false);
      expect(result!.preservedAs).toMatch(/customer\.json\.corrupt\./);
      expect(existsSync(result!.preservedAs)).toBe(true);
    });

    it('maps agent name → family (customer-lifecycle → customer)', async () => {
      write('customer', { marker: 'from-customer-family' });
      const result = (await service.read('customer-lifecycle')) as { marker: string };
      expect(result.marker).toBe('from-customer-family');
    });

    it('maps support-triage and agent-orchestrator to the shared ops family', async () => {
      write('ops', { marker: 'shared-ops' });
      const tri = (await service.read('support-triage')) as { marker: string };
      const orch = (await service.read('agent-orchestrator')) as { marker: string };
      expect(tri.marker).toBe('shared-ops');
      expect(orch.marker).toBe('shared-ops');
    });
  });

  describe('aggregateStatus()', () => {
    it('returns empty shape when state dir does not exist', async () => {
      (service as unknown as { stateDir: string }).stateDir = join(stateDir, 'missing');
      await expect(service.aggregateStatus()).resolves.toEqual({
        families: [],
        page: 1,
        limit: 10,
        total: 0,
      });
    });

    it('sanitizes every family payload before returning it', async () => {
      write('customer', { token: 't' });
      write('ops', { secret: 's' });
      const result = await service.aggregateStatus();
      const customer = result.families.find((f) => f.family === 'customer');
      const ops = result.families.find((f) => f.family === 'ops');
      expect((customer?.state as { token: string }).token).toBe('[REDACTED]');
      expect((ops?.state as { secret: string }).secret).toBe('[REDACTED]');
    });

    it('paginates with page/limit', async () => {
      ['customer', 'ops', 'fleet', 'billing', 'content'].forEach((f) => write(f, { f }));
      const page1 = await service.aggregateStatus(1, 2);
      expect(page1.families).toHaveLength(2);
      expect(page1.total).toBe(5);
      const page3 = await service.aggregateStatus(3, 2);
      expect(page3.families).toHaveLength(1);
      expect(page3.total).toBe(5);
    });

    it('ignores non-json files in the state dir', async () => {
      write('customer', { ok: 1 });
      writeFileSync(join(stateDir, 'README.md'), 'notes');
      writeFileSync(join(stateDir, '.lock'), '');
      const result = await service.aggregateStatus();
      expect(result.total).toBe(1);
      expect(result.families[0].family).toBe('customer');
    });
  });

  describe('enqueueManualRun()', () => {
    it('throws for unknown agent name', async () => {
      await expect(service.enqueueManualRun('not-a-real-agent')).rejects.toThrow(
        /unknown agent family/,
      );
    });

    it('creates the state dir if it is missing', async () => {
      const missingDir = join(stateDir, 'nested', 'deep');
      (service as unknown as { stateDir: string }).stateDir = missingDir;
      await service.enqueueManualRun('customer-lifecycle');
      expect(existsSync(join(missingDir, 'customer.json'))).toBe(true);
    });

    it('writes pendingManualRun=true with an ISO timestamp', async () => {
      const result = await service.enqueueManualRun('customer-lifecycle');
      expect(result).toEqual({ enqueued: 'customer-lifecycle', family: 'customer' });
      const file = JSON.parse(readFileSync(join(stateDir, 'customer.json'), 'utf-8'));
      expect(file.pendingManualRun).toBe(true);
      expect(typeof file.pendingManualRunRequestedAt).toBe('string');
      expect(() => new Date(file.pendingManualRunRequestedAt).toISOString()).not.toThrow();
    });

    it('preserves existing fields and only overwrites the manual-run flag', async () => {
      write('customer', { lastRunAt: '2026-01-01T00:00:00.000Z', runCount: 7 });
      await service.enqueueManualRun('customer-lifecycle');
      const file = JSON.parse(readFileSync(join(stateDir, 'customer.json'), 'utf-8'));
      expect(file.lastRunAt).toBe('2026-01-01T00:00:00.000Z');
      expect(file.runCount).toBe(7);
      expect(file.pendingManualRun).toBe(true);
    });

    it('releases the .lock file on success', async () => {
      await service.enqueueManualRun('customer-lifecycle');
      expect(existsSync(join(stateDir, 'customer.json.lock'))).toBe(false);
    });

    it('acquires the .lock file — waits out a pre-existing fresh lock and eventually writes', async () => {
      // A stale lock older than LOCK_STALE_MS (30s) is taken over; here we
      // write a truly fresh lock and verify the call still completes within
      // LOCK_TIMEOUT_MS by clearing the lock mid-wait.
      const lockPath = join(stateDir, 'customer.json.lock');
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      const pending = service.enqueueManualRun('customer-lifecycle');
      // Clear the lock after a short wait to simulate cron worker release
      setTimeout(() => { try { rmSync(lockPath); } catch { /* ignore */ } }, 150);
      await pending;
      expect(existsSync(join(stateDir, 'customer.json'))).toBe(true);
    });

    // R4-MED10: the file lock is the only thing standing between two manual
    // triggers landing on each other. If Promise.all on two enqueue calls
    // corrupts the file, we lose the pendingManualRun flag silently.
    it('serializes concurrent enqueueManualRun calls — no lost writes', async () => {
      write('customer', { runCount: 5, existingField: 'preserved' });
      await Promise.all([
        service.enqueueManualRun('customer-lifecycle'),
        service.enqueueManualRun('customer-lifecycle'),
      ]);
      const file = JSON.parse(
        readFileSync(join(stateDir, 'customer.json'), 'utf-8'),
      );
      // Both writes must have landed cleanly (valid JSON, nothing clobbered).
      expect(file.runCount).toBe(5);
      expect(file.existingField).toBe('preserved');
      expect(file.pendingManualRun).toBe(true);
      // Lock must have been released — otherwise subsequent calls hit 503.
      expect(existsSync(join(stateDir, 'customer.json.lock'))).toBe(false);
    });

    // Heavier contention test — scales the race to 10 concurrent writers and
    // preloads a large (>64KB) existing field so partial-write bugs would
    // straddle write-buffer boundaries and leave corrupt JSON on disk. With
    // the lock intact every writer observes a consistent file; without it,
    // at least one read-modify-write would hit torn state and throw.
    it('holds under 10-way concurrent contention without torn writes', async () => {
      const bigPayload = 'x'.repeat(70_000);
      write('customer', { runCount: 42, bigField: bigPayload });
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          service.enqueueManualRun('customer-lifecycle'),
        ),
      );
      // Every call completed (no 503, no JSON parse throws mid-critical-section).
      expect(results).toHaveLength(10);
      results.forEach((r) =>
        expect(r).toEqual({ enqueued: 'customer-lifecycle', family: 'customer' }),
      );
      // Post-state: file is parseable, existing fields preserved, flag set.
      const file = JSON.parse(
        readFileSync(join(stateDir, 'customer.json'), 'utf-8'),
      );
      expect(file.runCount).toBe(42);
      expect(file.bigField).toBe(bigPayload);
      expect(file.pendingManualRun).toBe(true);
      // Exactly one timestamp remains (last writer wins under the lock).
      expect(typeof file.pendingManualRunRequestedAt).toBe('string');
      // No orphaned lock.
      expect(existsSync(join(stateDir, 'customer.json.lock'))).toBe(false);
    });

    // Release-path invariant: if our lock gets stolen mid-critical-section
    // (31s+ GC pause simulated by pre-seeding someone else's token), our
    // release must NOT unlink the new holder's lock. The new holder's token
    // survives the release call.
    it('skips unlink when lock token no longer matches (stolen-lock safety)', async () => {
      const lockPath = join(stateDir, 'customer.json.lock');
      // Pre-run to get a baseline lock lifecycle (acquire + release).
      await service.enqueueManualRun('customer-lifecycle');
      // Now simulate a concurrent holder installing their own token file
      // BEFORE our next release runs. We fake this by pre-populating the
      // lock with a foreign token; a subsequent enqueue will see the file
      // exists, wait it out, and eventually take over if stale. For the
      // stolen-release path specifically, we need to directly exercise
      // releaseLock with a non-matching token — reach in via the service.
      writeFileSync(lockPath, 'foreign-token-from-another-process');
      const svc = service as unknown as {
        releaseLock: (lockFile: string, token: string) => Promise<void>;
      };
      await svc.releaseLock(lockPath, 'our-stale-token');
      // Lock file must still be there — we correctly skipped unlink.
      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(lockPath, 'utf-8')).toBe('foreign-token-from-another-process');
      // Clean up for subsequent tests in this describe block.
      rmSync(lockPath, { force: true });
    });

    it('takes over a stale lock whose mtime is older than LOCK_STALE_MS (30s)', async () => {
      const lockPath = join(stateDir, 'customer.json.lock');
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      // Backdate mtime by 31s so acquireLock treats the lock as abandoned.
      const oldTime = new Date(Date.now() - 31_000);
      utimesSync(lockPath, oldTime, oldTime);
      await service.enqueueManualRun('customer-lifecycle');
      expect(existsSync(join(stateDir, 'customer.json'))).toBe(true);
      expect(existsSync(lockPath)).toBe(false);
    });

    it(
      'throws ServiceUnavailableException when the lock is held past the timeout',
      async () => {
        // Held, fresh lock (mtime is current so acquireLock can't steal it).
        // Real timers + an extended test timeout so acquireLock's 5s retry
        // loop exhausts exactly the same way it would in production.
        const lockPath = join(stateDir, 'customer.json.lock');
        const fd = openSync(lockPath, 'wx');
        closeSync(fd);
        try {
          await expect(
            service.enqueueManualRun('customer-lifecycle'),
          ).rejects.toThrow(ServiceUnavailableException);
        } finally {
          rmSync(lockPath, { force: true });
        }
      },
      10_000,
    );
  });
});
