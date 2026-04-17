import { AgentStateService } from './agent-state.service';
import {
  mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync,
  openSync, closeSync,
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

  const write = (family: string, data: unknown) => {
    writeFileSync(join(stateDir, `${family}.json`), JSON.stringify(data));
  };

  describe('sanitize / FORBIDDEN_KEY_REGEX (D9 + R2)', () => {
    it.each([
      'token',
      'apiToken',
      'secret',
      'clientSecret',
      'key',
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

    it('returns null when the family file is malformed JSON', async () => {
      writeFileSync(join(stateDir, 'customer.json'), 'not-json{');
      await expect(service.read('customer-lifecycle')).resolves.toBeNull();
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
  });
});
