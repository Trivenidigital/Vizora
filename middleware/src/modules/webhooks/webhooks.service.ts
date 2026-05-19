import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { assertUrlIsPublic, SsrfError } from '../common/utils/ssrf-guard';
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
 * Cross-org guards on every read/write. SSRF guard resolves DNS and
 * rejects loopback / RFC1918 / link-local / IPv6 loopback/ULA/link-local
 * — runs at create/update AND at delivery time so a DNS-rebind that
 * flips after config-validation is also caught. HMAC-SHA256 signing
 * with the customer's secret, sent in the X-Vizora-Signature header.
 *
 * Auto-disable on AUTO_DISABLE_THRESHOLD consecutive failures — defends
 * customers from a misbehaving endpoint accumulating noise indefinitely.
 *
 * The webhook secret is NEVER returned from any controller-facing
 * method. Customers keep their own copy of the secret they submitted;
 * the server only stores it for signing outbound deliveries.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Single select shape — secret is intentionally omitted everywhere
  // except findActiveSubscribers (internal use, never returned to a
  // controller).
  private readonly RESPONSE_SELECT = {
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
  } as const;

  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(organizationId: string, dto: CreateWebhookDto) {
    await this.assertUrlSafe(dto.url);

    // PR-review fix (post-merge): use the same secret-less select shape
    // as findAll/findOne/update. Response bodies get logged, cached,
    // and recorded in more places than request bodies; the customer
    // already has their own copy of the secret they submitted.
    return this.db.webhook.create({
      data: {
        organizationId,
        name: dto.name,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        isActive: dto.isActive ?? true,
      },
      select: this.RESPONSE_SELECT,
    });
  }

  async findAll(organizationId: string) {
    return this.db.webhook.findMany({
      where: { organizationId },
      select: this.RESPONSE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const hook = await this.db.webhook.findFirst({
      where: { id, organizationId },
      select: this.RESPONSE_SELECT,
    });
    if (!hook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    return hook;
  }

  async update(organizationId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOne(organizationId, id);
    if (dto.url !== undefined) await this.assertUrlSafe(dto.url);

    return this.db.webhook.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.secret !== undefined ? { secret: dto.secret } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive, failureCount: 0 } : {}),
      },
      select: this.RESPONSE_SELECT,
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

    let ok = false;
    let errMsg: string | null = null;

    // PR-review fix (post-merge): re-run the SSRF guard at delivery
    // time. The URL was validated at create/update, but DNS can flip
    // between then and now (DNS-rebind, infrastructure migration, etc.)
    // — re-resolving makes a flip caught here rather than connecting to
    // an internal address.
    try {
      await this.assertUrlSafe(webhook.url);
    } catch (err) {
      errMsg = err instanceof Error ? err.message : 'unknown';
      await this.recordFailure(webhook.id, errMsg);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

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
        // not redirector chains. Treat a 3xx as a misconfiguration — a
        // redirect chain would also bypass the SSRF guard above.
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

    await this.recordFailure(webhook.id, errMsg);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async recordFailure(webhookId: string, errMsg: string | null): Promise<void> {
    const updated = await this.db.webhook.update({
      where: { id: webhookId },
      data: {
        lastDeliveryAt: new Date(),
        lastError: errMsg,
        failureCount: { increment: 1 },
      },
      select: { failureCount: true },
    });

    if (updated.failureCount >= AUTO_DISABLE_THRESHOLD) {
      await this.db.webhook.update({
        where: { id: webhookId },
        data: { isActive: false },
      });
      this.logger.warn(
        `Webhook ${webhookId} auto-disabled after ${updated.failureCount} consecutive failures (last error: ${errMsg})`,
      );
    }
  }

  private signBody(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  /**
   * Validate URL is safe to dispatch to. HTTPS-only, public-resolution
   * only. Used at create/update AND at every delivery (see deliver()
   * for why).
   */
  private async assertUrlSafe(url: string): Promise<void> {
    try {
      await assertUrlIsPublic(url);
    } catch (err) {
      if (err instanceof SsrfError) {
        throw new BadRequestException(`webhook ${err.message}`);
      }
      throw err;
    }
  }
}
