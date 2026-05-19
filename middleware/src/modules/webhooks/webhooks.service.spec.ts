import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';
import { WebhooksService } from './webhooks.service';
import { DatabaseService } from '../database/database.service';
import { AUTO_DISABLE_THRESHOLD, SIGNATURE_HEADER, EVENT_HEADER } from './webhook.types';

jest.mock('dns/promises');

describe('WebhooksService', () => {
  let service: WebhooksService;
  let db: any;
  const orgId = 'org-123';

  const originalFetch = global.fetch;
  const mockLookup = dns.lookup as unknown as jest.Mock;

  beforeEach(() => {
    db = {
      webhook: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new WebhooksService(db as unknown as DatabaseService);

    // Default DNS: public IP. Per-test mocks override for SSRF tests.
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
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

    // PR-review fix (post-merge): create MUST NOT include secret in
    // the response. The secret-less select shape is enforced server-
    // side; response bodies get logged/cached in more places than
    // request bodies. Customers keep their own copy.
    it('does NOT include the secret field in the create response shape', async () => {
      db.webhook.create.mockResolvedValue({ id: 'hook-1' });
      await service.create(orgId, dto);

      const call = db.webhook.create.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.secret).toBeUndefined();
      // Sanity: the secret WAS persisted (just not selected back).
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

    // PR-review fix (post-merge): DNS rebind — public-looking hostname
    // that resolves to private IP. The pre-fix hostname regex would
    // have let this through.
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
      expect(call.select.secret).toBeUndefined();      // secret intentionally NOT selected
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
      db.webhook.update.mockResolvedValue({ id: 'hook-1' });

      await service.update(orgId, 'hook-1', { isActive: true });

      expect(db.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
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
      db.webhook.update.mockResolvedValue({ id: 'hook-1' });

      await service.update(orgId, 'hook-1', { name: 'renamed' });

      const call = db.webhook.update.mock.calls[0][0];
      expect(call.select.secret).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws NotFound on cross-org DELETE', async () => {
      db.webhook.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'hook-x')).rejects.toThrow(NotFoundException);
      expect(db.webhook.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deliver — HMAC signing + auto-disable + SSRF re-check
  // ---------------------------------------------------------------------------
  describe('deliver', () => {
    const hook = { id: 'hook-1', url: 'https://hooks.customer.example.com/v1', secret: 'a'.repeat(32) };

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

      // Verify the signature math directly
      const expected = crypto.createHmac('sha256', hook.secret).update(init.body).digest('hex');
      expect(signature).toBe(`sha256=${expected}`);
    });

    it('on success: resets failureCount and clears lastError', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
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
      // Simulate the counter just crossing the threshold
      db.webhook.update.mockResolvedValueOnce({ failureCount: AUTO_DISABLE_THRESHOLD });
      db.webhook.update.mockResolvedValueOnce({});                       // second update for auto-disable
      await service.deliver(hook, 'display.paired', {});

      // 2 updates: the failure increment + the auto-disable flip
      expect(db.webhook.update).toHaveBeenCalledTimes(2);
      const disableCall = db.webhook.update.mock.calls[1][0];
      expect(disableCall.data.isActive).toBe(false);
    });

    // PR-review fix (post-merge): SSRF re-check at delivery time. URL
    // was validated at create time, but DNS can flip. A rebind that
    // points the same hostname at 127.0.0.1 between create and deliver
    // must be caught — without re-resolving here we'd happily POST the
    // signed payload at the internal endpoint.
    describe('SSRF re-check at delivery time', () => {
      it('skips fetch when delivery-time DNS resolves to a private IP', async () => {
        // create-time resolution would have been public; now DNS has
        // flipped to private.
        mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy as any;
        db.webhook.update.mockResolvedValue({ failureCount: 1 });

        await service.deliver(hook, 'display.paired', {});

        // Critical: fetch MUST NOT have been called.
        expect(fetchSpy).not.toHaveBeenCalled();

        // Failure was recorded (so the customer can see why their
        // webhook is no longer firing) and counter incremented (so
        // auto-disable still trips eventually if DNS stays broken).
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
  });
});
