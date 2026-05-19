import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import {
  AUTO_DISABLE_THRESHOLD,
  DELIVERY_TIMEOUT_MS,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  WebhookEvent,
} from './webhook.types';

/**
 * O5 — Webhook CRUD + delivery.
 *
 * Cross-org guards on every read/write. SSRF guard rejects loopback /
 * RFC1918 / link-local / IPv6 loopback/ULA/link-local (same pattern as
 * O8's GenericApiDataSource). HMAC-SHA256 signing with the customer's
 * secret, sent in the X-Vizora-Signature header.
 *
 * Auto-disable on AUTO_DISABLE_THRESHOLD consecutive failures — defends
 * customers from a misbehaving endpoint accumulating noise indefinitely.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Same SSRF block list as GenericApiDataSource (O8).
  private readonly BLOCKED_HOSTS: RegExp[] = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^::$/,
    /^::ffff:/i,
    /^2002:/i,
    /^fc00:/i,
    /^fe80:/i,
  ];

  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(organizationId: string, dto: CreateWebhookDto) {
    this.assertUrlSafe(dto.url);

    return this.db.webhook.create({
      data: {
        organizationId,
        name: dto.name,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(organizationId: string) {
    // Don't return the secret in the list response. Customers should keep
    // their copy from the create response; we never need to expose it again.
    return this.db.webhook.findMany({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveryAt: true,
        lastError: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const hook = await this.db.webhook.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveryAt: true,
        lastError: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!hook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    return hook;
  }

  async update(organizationId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOne(organizationId, id);
    if (dto.url !== undefined) this.assertUrlSafe(dto.url);

    return this.db.webhook.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.secret !== undefined ? { secret: dto.secret } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive, failureCount: 0 } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveryAt: true,
        lastError: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.db.webhook.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Delivery (called from the @OnEvent dispatcher)
  // ---------------------------------------------------------------------------

  /**
   * Find every active hook in this org subscribed to `event`. Returns
   * with the secret included (needed for signing). Internal use only —
   * NEVER exposed to controller responses.
   */
  async findActiveSubscribers(organizationId: string, event: WebhookEvent) {
    return this.db.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
        events: { has: event },
      },
    });
  }

  /**
   * Deliver one event to one webhook. Idempotent at the customer end (the
   * customer is expected to dedupe via the request id, or via natural
   * domain idempotency).
   *
   * On success: lastDeliveryAt updated, lastError cleared, failureCount reset.
   * On failure: lastError set, failureCount incremented. When failureCount
   * crosses AUTO_DISABLE_THRESHOLD, isActive flips to false until an
   * operator manually re-enables (which resets the counter).
   */
  async deliver(
    webhook: { id: string; url: string; secret: string },
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString() });
    const signature = this.signBody(body, webhook.secret);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let ok = false;
    let errMsg: string | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: `sha256=${signature}`,
          [EVENT_HEADER]: event,
          'User-Agent': 'Vizora-Webhook/1.0',
        },
        body,
        signal: controller.signal,
        // No redirect-following: webhook URLs are explicit customer endpoints,
        // not redirector chains. Treat a 3xx as a misconfiguration.
        redirect: 'manual',
      });
      if (res.ok) {
        ok = true;
      } else {
        errMsg = `HTTP ${res.status}`;
      }
    } catch (err) {
      errMsg = err instanceof Error ? err.message : 'unknown';
    } finally {
      clearTimeout(timeoutId);
    }

    if (ok) {
      await this.db.webhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveryAt: new Date(),
          lastError: null,
          failureCount: 0,
        },
      });
      return;
    }

    // Failed: increment counter and possibly auto-disable.
    const updated = await this.db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastError: errMsg,
        failureCount: { increment: 1 },
      },
      select: { failureCount: true },
    });

    if (updated.failureCount >= AUTO_DISABLE_THRESHOLD) {
      await this.db.webhook.update({
        where: { id: webhook.id },
        data: { isActive: false },
      });
      this.logger.warn(
        `Webhook ${webhook.id} auto-disabled after ${updated.failureCount} consecutive failures (last error: ${errMsg})`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private signBody(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  private assertUrlSafe(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('webhook url is not a valid absolute URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('webhook url must use HTTPS');
    }
    // Strip IPv6 brackets so the regex patterns match the bare address.
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (this.BLOCKED_HOSTS.some((p) => p.test(hostname))) {
      throw new BadRequestException('webhook url points to a blocked address');
    }
  }
}
