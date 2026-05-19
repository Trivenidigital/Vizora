import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import { assertUrlIsPublic, SsrfError } from '../common/utils/ssrf-guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import {
  AUTO_DISABLE_THRESHOLD,
  DELIVERY_TIMEOUT_MS,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  WebhookEvent,
  WebhookDeliveryStatus,
} from './webhook.types';

/**
 * O5 — Webhook CRUD + delivery + per-delivery audit.
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
 * Every deliver() attempt records a WebhookDelivery audit row (status
 * one of success / failure / blocked). The summary fields on the
 * Webhook row (`lastDeliveryAt` / `lastError` / `failureCount`) are
 * kept for fast row-level reads in CRUD responses; the audit table is
 * the source of truth for delivery history.
 *
 * The webhook secret is NEVER returned from any controller-facing
 * method. Customers keep their own copy of the secret they submitted;
 * the server only stores it for signing outbound deliveries.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Cap on errorMessage column width — audit rows hold short error
  // text only, never full upstream response bodies.
  private static readonly MAX_ERROR_MSG_LENGTH = 500;

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
  // Delivery audit listing
  // ---------------------------------------------------------------------------

  /**
   * Paginated audit log for one webhook. Cross-org guarded via findOne
   * — NotFound for foreign-org webhook id, identical to the other
   * per-webhook endpoints. Newest-first; optional status filter.
   */
  async findDeliveries(
    organizationId: string,
    webhookId: string,
    query: ListDeliveriesDto,
  ) {
    await this.findOne(organizationId, webhookId); // cross-org guard

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: { webhookId: string; status?: string } = { webhookId };
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      this.db.webhookDelivery.findMany({
        where,
        orderBy: { attemptedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.webhookDelivery.count({ where }),
    ]);

    return new PaginatedResponse(rows, total, page, limit);
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
   *
   * Every attempt — success, HTTP failure, network error, SSRF-blocked
   * — records a WebhookDelivery audit row.
   */
  async deliver(
    webhook: { id: string; organizationId: string; url: string; secret: string },
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const startedAt = Date.now();
    const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString() });
    const signature = this.signBody(body, webhook.secret);

    // PR-review fix (post-merge): re-run the SSRF guard at delivery
    // time. The URL was validated at create/update, but DNS can flip
    // between then and now (DNS-rebind, infrastructure migration, etc.)
    // — re-resolving makes a flip caught here rather than connecting to
    // an internal address. The audit row gets status='blocked' so the
    // customer can see that the dispatch never went out.
    try {
      await this.assertUrlSafe(webhook.url);
    } catch (err) {
      const errMsg = this.truncateError(err instanceof Error ? err.message : 'unknown');
      await this.recordAttempt(webhook, event, 'blocked', null, errMsg, Date.now() - startedAt);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let status: WebhookDeliveryStatus = 'failure';
    let statusCode: number | null = null;
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
        // not redirector chains. Treat a 3xx as a misconfiguration — a
        // redirect chain would also bypass the SSRF guard above.
        redirect: 'manual',
      });
      statusCode = res.status;
      if (res.ok) {
        status = 'success';
      } else {
        errMsg = `HTTP ${res.status}`;
      }
    } catch (err) {
      errMsg = this.truncateError(err instanceof Error ? err.message : 'unknown');
    } finally {
      clearTimeout(timeoutId);
    }

    await this.recordAttempt(webhook, event, status, statusCode, errMsg, Date.now() - startedAt);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Records an audit row + updates the summary fields on the Webhook
   * row + auto-disables if the failure counter trips. Single write-path
   * for all four delivery outcomes (success / failure / blocked).
   */
  private async recordAttempt(
    webhook: { id: string; organizationId: string },
    event: WebhookEvent,
    status: WebhookDeliveryStatus,
    statusCode: number | null,
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    // Audit row first — best-effort. If audit insert fails for any
    // reason (table missing, schema drift), we still want to update
    // the summary row so the customer sees lastError move. Log and
    // continue.
    try {
      await this.db.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          organizationId: webhook.organizationId,
          event,
          status,
          statusCode,
          errorMessage,
          durationMs,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record WebhookDelivery audit row for ${webhook.id}/${event}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    if (status === 'success') {
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

    // failure or blocked — increment counter, possibly auto-disable
    const updated = await this.db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastError: errorMessage,
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
        `Webhook ${webhook.id} auto-disabled after ${updated.failureCount} consecutive failures (last error: ${errorMessage})`,
      );
    }
  }

  private truncateError(msg: string): string {
    if (msg.length <= WebhooksService.MAX_ERROR_MSG_LENGTH) return msg;
    return msg.slice(0, WebhooksService.MAX_ERROR_MSG_LENGTH - 3) + '...';
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
