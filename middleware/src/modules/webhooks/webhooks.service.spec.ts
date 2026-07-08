import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';
import { WebhooksService } from './webhooks.service';
import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { AUTO_DISABLE_THRESHOLD, SIGNATURE_HEADER, EVENT_HEADER } from './webhook.types';

jest.mock('dns/promises');
jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

describe('WebhooksService', () => {
  let service: WebhooksService;
  let db: any;
  let metrics: any;
  const orgId = 'org-123';

  const originalFetch = global.fetch;
  const mockLookup = dns.lookup as unknown as jest.Mock;
  const mockSentryCapture = Sentry.captureException as unknown as jest.Mock;

  beforeEach(() => {
    db = {
      webhook: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      webhookDelivery: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    metrics = {
      webhookDeliveriesTotal: { inc: jest.fn() },
      webhookAuditFailuresTotal: { inc: jest.fn() },
    };
    service = new WebhooksService(
      db as unknown as DatabaseService,
      metrics as unknown as MetricsService,
    );

    // Default DNS: public IP. Per-test mocks override for SSRF tests.
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockSentryCapture.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create — SSRF + URL validation + secret-not-in-response
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      name: 'my-hook',
      url: 'https://hooks.customer.example.com/v1',
      secret: 'a'.repeat(32),
      events: ['display.paired' as const],
    };

    it('happy path — creates the webhook', async () => {
      db.webhook.create.mockResolvedValue({ id: 'hook-1' });
      await service.create(orgId, dto);
      expect(db.webhook.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT include the secret field in the create response shape', async () => {
      db.webhook.create.mockResolvedValue({ id: 'hook-1' });
      await service.create(orgId, dto);

      const call = db.webhook.create.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.secret).toBeUndefined();
      expect(call.data.secret).toBe(dto.secret);
    });

    it('rejects http:// (HTTPS required)', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'http://hooks.customer.example.com/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects localhost', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'https://localhost/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 192.168.x', async () => {
      mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);
      await expect(
        service.create(orgId, { ...dto, url: 'https://192.168.1.1/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv4-mapped IPv6 ::ffff:127.0.0.1', async () => {
      mockLookup.mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }]);
      await expect(
        service.create(orgId, { ...dto, url: 'https://[::ffff:127.0.0.1]/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 6to4 2002:: prefix', async () => {
      mockLookup.mockResolvedValue([{ address: '2002:7f00:1::', family: 6 }]);
      await expect(
        service.create(orgId, { ...dto, url: 'https://[2002:7f00:1::]/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects malformed URL', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects DNS rebind: public hostname resolves to 127.0.0.1', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(
        service.create(orgId, { ...dto, url: 'https://attacker.example/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects DNS rebind: public hostname resolves to AWS IMDS', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(
        service.create(orgId, { ...dto, url: 'https://innocent.example/v1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll / findOne — secret never exposed
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('does NOT include the secret field in the response shape', async () => {
      db.webhook.findMany.mockResolvedValue([]);
      await service.findAll(orgId);

      const call = db.webhook.findMany.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.secret).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('throws NotFound when webhook belongs to another org', async () => {
      db.webhook.findFirst.mockResolvedValue(null);
      await expect(service.findOne(orgId, 'hook-foreign')).rejects.toThrow(NotFoundException);
    });

    it('does NOT include the secret field in the response', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: 'hook-1', organizationId: orgId, name: 'h' });
      await service.findOne(orgId, 'hook-1');

      const call = db.webhook.findFirst.mock.calls[0][0];
      expect(call.select.secret).toBeUndefined();
    });
  });

  describe('update', () => {
    it('throws NotFound on cross-org PATCH', async () => {
      db.webhook.findFirst.mockResolvedValue(null);
      await expect(service.update(orgId, 'hook-x', { name: 'y' })).rejects.toThrow(NotFoundException);
      expect(db.webhook.update).not.toHaveBeenCalled();
    });

    it('flipping isActive false→true resets failureCount (re-arm after manual fix)', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: 'hook-1', organizationId: orgId });

      await service.update(orgId, 'hook-1', { isActive: true });

      // Org-scoped write via updateMany; the entity is then re-fetched.
      expect(db.webhook.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hook-1', organizationId: orgId },
          data: expect.objectContaining({ isActive: true, failureCount: 0 }),
        }),
      );
    });

    it('SSRF guard runs on URL change too', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: 'hook-1', organizationId: orgId });
      await expect(
        service.update(orgId, 'hook-1', { url: 'https://localhost/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('update response does NOT include the secret field', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: 'hook-1', organizationId: orgId });

      await service.update(orgId, 'hook-1', { name: 'renamed' });

      // The response now comes from the org-scoped re-fetch (findFirst with RESPONSE_SELECT).
      const refetch = db.webhook.findFirst.mock.calls.find((c: any[]) => c[0]?.select);
      expect(refetch?.[0].select.secret).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws NotFound on cross-org DELETE (deleteMany affects zero rows)', async () => {
      db.webhook.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(orgId, 'hook-x')).rejects.toThrow(NotFoundException);
      expect(db.webhook.deleteMany).toHaveBeenCalledWith({ where: { id: 'hook-x', organizationId: orgId } });
      expect(db.webhook.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deliver — HMAC + auto-disable + SSRF re-check + audit row
  // ---------------------------------------------------------------------------
  describe('deliver', () => {
    const hook = {
      id: 'hook-1',
      organizationId: orgId,
      url: 'https://hooks.customer.example.com/v1',
      secret: 'a'.repeat(32),
    };

    it('signs the body with HMAC-SHA256 and POSTs with the signature header', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchSpy as any;
      db.webhook.update.mockResolvedValue({ failureCount: 0 });

      await service.deliver(hook, 'display.paired', { organizationId: orgId, displayId: 'd1' });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(hook.url);
      expect(init.method).toBe('POST');
      expect(init.headers[EVENT_HEADER]).toBe('display.paired');

      const signature = init.headers[SIGNATURE_HEADER];
      expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);

      const expected = crypto.createHmac('sha256', hook.secret).update(init.body).digest('hex');
      expect(signature).toBe(`sha256=${expected}`);
    });

    it('on success: resets failureCount and clears lastError', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
      db.webhook.update.mockResolvedValue({ failureCount: 0 });

      await service.deliver(hook, 'display.paired', {});

      const call = db.webhook.update.mock.calls[0][0];
      expect(call.data.lastError).toBeNull();
      expect(call.data.failureCount).toBe(0);
    });

    it('on HTTP failure: increments failureCount and records lastError', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
      db.webhook.update.mockResolvedValue({ failureCount: 1 });

      await service.deliver(hook, 'display.paired', {});

      const call = db.webhook.update.mock.calls[0][0];
      expect(call.data.lastError).toContain('HTTP 500');
      expect(call.data.failureCount).toEqual({ increment: 1 });
    });

    it('on network failure: records error message and increments counter', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
      db.webhook.update.mockResolvedValue({ failureCount: 1 });

      await service.deliver(hook, 'display.paired', {});

      const call = db.webhook.update.mock.calls[0][0];
      expect(call.data.lastError).toBe('ECONNREFUSED');
    });

    it('auto-disables after AUTO_DISABLE_THRESHOLD consecutive failures', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
      db.webhook.update.mockResolvedValueOnce({ failureCount: AUTO_DISABLE_THRESHOLD });
      db.webhook.update.mockResolvedValueOnce({});
      await service.deliver(hook, 'display.paired', {});

      expect(db.webhook.update).toHaveBeenCalledTimes(2);
      const disableCall = db.webhook.update.mock.calls[1][0];
      expect(disableCall.data.isActive).toBe(false);
    });

    describe('SSRF re-check at delivery time', () => {
      it('skips fetch when delivery-time DNS resolves to a private IP', async () => {
        mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        expect(fetchSpy).not.toHaveBeenCalled();

        const call = db.webhook.update.mock.calls[0][0];
        expect(call.data.lastError).toMatch(/blocked address/);
        expect(call.data.failureCount).toEqual({ increment: 1 });
      });

      it('skips fetch when delivery-time DNS resolves to IMDS', async () => {
        mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it('uses redirect:manual on the dispatched fetch (defense vs SSRF via 3xx hop)', async () => {
        const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchSpy as any;
        db.webhook.update.mockResolvedValue({ failureCount: 0 });

        await service.deliver(hook, 'display.paired', {});

        const init = fetchSpy.mock.calls[0][1];
        expect(init.redirect).toBe('manual');
      });
    });

    // -------------------------------------------------------------------------
    // Audit table — records a row at every exit (success, failure, blocked)
    // -------------------------------------------------------------------------
    describe('audit row recording', () => {
      it('records success row with statusCode, no error, status=success', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
        db.webhook.update.mockResolvedValue({ failureCount: 0 });

        await service.deliver(hook, 'display.paired', {});

        expect(db.webhookDelivery.create).toHaveBeenCalledTimes(1);
        const row = db.webhookDelivery.create.mock.calls[0][0].data;
        expect(row.webhookId).toBe(hook.id);
        expect(row.organizationId).toBe(orgId);
        expect(row.event).toBe('display.paired');
        expect(row.status).toBe('success');
        expect(row.statusCode).toBe(200);
        expect(row.errorMessage).toBeNull();
        expect(typeof row.durationMs).toBe('number');
        expect(row.durationMs).toBeGreaterThanOrEqual(0);

        // Every successful audit insert increments the deliveries
        // counter — gives Grafana a delivery-rate signal and acts as
        // independent evidence that the dispatch path reached the DB.
        expect(metrics.webhookDeliveriesTotal.inc).toHaveBeenCalledWith({
          status: 'success',
          event: 'display.paired',
        });
      });

      it('records failure row on HTTP non-2xx with statusCode + errorMessage', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        const row = db.webhookDelivery.create.mock.calls[0][0].data;
        expect(row.status).toBe('failure');
        expect(row.statusCode).toBe(503);
        expect(row.errorMessage).toBe('HTTP 503');
      });

      it('records failure row on network error with errorMessage, no statusCode', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT')) as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        const row = db.webhookDelivery.create.mock.calls[0][0].data;
        expect(row.status).toBe('failure');
        expect(row.statusCode).toBeNull();
        expect(row.errorMessage).toBe('ETIMEDOUT');
      });

      it('records blocked row when SSRF guard rejects at delivery time', async () => {
        mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
        global.fetch = jest.fn();
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        const row = db.webhookDelivery.create.mock.calls[0][0].data;
        expect(row.status).toBe('blocked');
        expect(row.statusCode).toBeNull();
        expect(row.errorMessage).toMatch(/blocked address/);
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('truncates errorMessage longer than MAX_ERROR_MSG_LENGTH (500)', async () => {
        const longErr = 'x'.repeat(700);
        global.fetch = jest.fn().mockRejectedValue(new Error(longErr)) as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        const row = db.webhookDelivery.create.mock.calls[0][0].data;
        expect(row.errorMessage.length).toBe(500);
        expect(row.errorMessage.endsWith('...')).toBe(true);
      });

      // Silent-failure prevention (CLAUDE.md §12). Best-effort behaviour
      // is preserved (transient audit failure doesn't block delivery),
      // but the failure surfaces via THREE independent signals so it
      // cannot be missed by the operator.
      describe('audit insert failure surfaces loudly (§12 silent-failure prevention)', () => {
        beforeEach(() => {
          db.webhookDelivery.create.mockRejectedValue(new Error('audit table missing'));
          global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
          db.webhook.update.mockResolvedValue({ failureCount: 0 });
        });

        it('does NOT block the summary-row update (best-effort delivery preserved)', async () => {
          await expect(service.deliver(hook, 'display.paired', {})).resolves.toBeUndefined();
          expect(db.webhook.update).toHaveBeenCalled();
        });

        it('increments the audit-failure Prom counter (Grafana / watchdog hook)', async () => {
          await service.deliver(hook, 'display.paired', {});
          expect(metrics.webhookAuditFailuresTotal.inc).toHaveBeenCalledWith({
            event: 'display.paired',
          });
          // Deliveries counter must NOT increment — the audit row did
          // not land.
          expect(metrics.webhookDeliveriesTotal.inc).not.toHaveBeenCalled();
        });

        it('emits a Sentry capture with component+webhook context (alert-at-write-site)', async () => {
          await service.deliver(hook, 'display.paired', {});

          expect(mockSentryCapture).toHaveBeenCalledTimes(1);
          const [err, ctx] = mockSentryCapture.mock.calls[0];
          expect(err).toBeInstanceOf(Error);
          expect((err as Error).message).toBe('audit table missing');
          expect(ctx.tags).toEqual({ component: 'webhooks', subsystem: 'delivery-audit' });
          expect(ctx.extra.webhookId).toBe(hook.id);
          expect(ctx.extra.organizationId).toBe(orgId);
          expect(ctx.extra.event).toBe('display.paired');
          // Intentionally NOT including errorMessage from the upstream
          // delivery — Sentry capture is about THIS insert failing.
          expect(ctx.extra.errorMessage).toBeUndefined();
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findDeliveries — paginated audit log read
  // ---------------------------------------------------------------------------
  describe('findDeliveries', () => {
    const webhookId = 'hook-1';

    it('throws NotFound when webhook belongs to another org (cross-org guard)', async () => {
      db.webhook.findFirst.mockResolvedValue(null);
      await expect(
        service.findDeliveries(orgId, 'hook-foreign', {}),
      ).rejects.toThrow(NotFoundException);
      expect(db.webhookDelivery.findMany).not.toHaveBeenCalled();
    });

    it('returns paginated newest-first results scoped to the webhook', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: webhookId, organizationId: orgId });
      db.webhookDelivery.findMany.mockResolvedValue([{ id: 'd-1' }, { id: 'd-2' }]);
      db.webhookDelivery.count.mockResolvedValue(42);

      const result = await service.findDeliveries(orgId, webhookId, { page: 1, limit: 10 });

      const findCall = db.webhookDelivery.findMany.mock.calls[0][0];
      expect(findCall.where.webhookId).toBe(webhookId);
      expect(findCall.orderBy).toEqual({ attemptedAt: 'desc' });
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(10);
      expect(result.meta.total).toBe(42);
      expect(result.meta.totalPages).toBe(5);
    });

    it('forwards status filter to the WHERE clause (find + count)', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: webhookId, organizationId: orgId });
      db.webhookDelivery.findMany.mockResolvedValue([]);
      db.webhookDelivery.count.mockResolvedValue(0);

      await service.findDeliveries(orgId, webhookId, { status: 'blocked' });

      const findCall = db.webhookDelivery.findMany.mock.calls[0][0];
      expect(findCall.where.status).toBe('blocked');

      const countCall = db.webhookDelivery.count.mock.calls[0][0];
      expect(countCall.where.status).toBe('blocked');
    });

    it('respects custom page/limit (page 3 of size 20 → skip 40)', async () => {
      db.webhook.findFirst.mockResolvedValue({ id: webhookId, organizationId: orgId });
      db.webhookDelivery.findMany.mockResolvedValue([]);
      db.webhookDelivery.count.mockResolvedValue(0);

      await service.findDeliveries(orgId, webhookId, { page: 3, limit: 20 });

      const findCall = db.webhookDelivery.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(40);
      expect(findCall.take).toBe(20);
    });
  });
});
