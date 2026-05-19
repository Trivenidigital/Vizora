import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';
import { DatabaseService } from '../database/database.service';
import { AUTO_DISABLE_THRESHOLD, SIGNATURE_HEADER, EVENT_HEADER } from './webhook.types';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let db: any;
  const orgId = 'org-123';

  const originalFetch = global.fetch;

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create — SSRF + URL validation
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
      await expect(
        service.create(orgId, { ...dto, url: 'https://192.168.1.1/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv4-mapped IPv6 ::ffff:127.0.0.1', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'https://[::ffff:127.0.0.1]/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 6to4 2002:: prefix', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'https://[2002:7f00:1::]/v1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects malformed URL', async () => {
      await expect(
        service.create(orgId, { ...dto, url: 'not-a-url' }),
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
  });

  describe('remove', () => {
    it('throws NotFound on cross-org DELETE', async () => {
      db.webhook.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'hook-x')).rejects.toThrow(NotFoundException);
      expect(db.webhook.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deliver — HMAC signing + auto-disable
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
  });
});
