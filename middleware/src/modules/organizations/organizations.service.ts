import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { BrandingConfigDto } from './dto/branding-config.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Convert BigInt fields to Number for JSON serialization.
   * PostgreSQL returns BigInt for storageUsedBytes/storageQuotaBytes,
   * but JSON.stringify cannot handle BigInt values.
   */
  private sanitizeOrg(org: Record<string, unknown> | null) {
    if (!org) return org;
    return {
      ...org,
      storageUsedBytes: Number(org.storageUsedBytes ?? 0),
      storageQuotaBytes: Number(org.storageQuotaBytes ?? 0),
    };
  }

  async create(createOrganizationDto: CreateOrganizationDto) {
    const existing = await this.db.organization.findUnique({
      where: { slug: createOrganizationDto.slug },
    });

    if (existing) {
      throw new ConflictException('Organization with this slug already exists');
    }

    const org = await this.db.organization.create({
      data: createOrganizationDto,
    });
    return this.sanitizeOrg(org);
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.organization.count(),
    ]);

    return new PaginatedResponse(data.map(org => this.sanitizeOrg(org)), total, page, limit);
  }

  /**
   * List onboarding candidates for the customer-lifecycle agent — orgs
   * created within the last `lookbackDays` whose onboarding hasn't
   * completed yet.
   *
   * Returns precomputed STRUCTURAL SIGNALS ONLY: org id, tier, days
   * since signup, and a milestone-flags map (booleans for welcomed /
   * screenPaired / contentUploaded / playlistCreated / scheduleCreated).
   * NO org name, NO admin email, NO billing detail. The structural-only
   * contract is enforced here so an LLM-driven downstream agent (Hermes
   * customer-lifecycle skill) can safely consume the output without
   * violating D13 (no raw user data into LLM prompts).
   *
   * Cross-org by design — this method takes no org filter. The MCP tool
   * layer guards this with a platform-scope-only token check.
   */
  async listOnboardingCandidates(
    options: { lookbackDays?: number; limit?: number } = {},
  ) {
    const { lookbackDays = 30, limit = 200 } = options;
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const rows = await this.db.organization.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { onboarding: null },
          { onboarding: { completedAt: null } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        subscriptionTier: true,
        createdAt: true,
        onboarding: {
          select: {
            welcomeEmailSentAt: true,
            firstScreenPairedAt: true,
            firstContentUploadedAt: true,
            firstPlaylistCreatedAt: true,
            firstScheduleCreatedAt: true,
            day1NudgeSentAt: true,
            day3NudgeSentAt: true,
            day7NudgeSentAt: true,
            completedAt: true,
          },
        },
      },
    });

    const now = Date.now();
    return rows.map((org) => {
      const ob = org.onboarding;
      return {
        organizationId: org.id,
        tier: this.coerceTier(org.subscriptionTier),
        daysSinceSignup: Math.floor(
          (now - org.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
        milestoneFlags: {
          welcomed: ob?.welcomeEmailSentAt != null,
          screenPaired: ob?.firstScreenPairedAt != null,
          contentUploaded: ob?.firstContentUploadedAt != null,
          playlistCreated: ob?.firstPlaylistCreatedAt != null,
          scheduleCreated: ob?.firstScheduleCreatedAt != null,
        },
        nudgesSent: {
          day1: ob?.day1NudgeSentAt != null,
          day3: ob?.day3NudgeSentAt != null,
          day7: ob?.day7NudgeSentAt != null,
        },
      };
    });
  }

  /**
   * Same coercion the customer-lifecycle PM2 cron uses. Kept inline so
   * this service doesn't depend on agent-side types.
   */
  private coerceTier(tier: string | null | undefined): 'free' | 'starter' | 'pro' | 'enterprise' {
    const v = (tier ?? '').toLowerCase();
    if (v === 'starter' || v === 'pro' || v === 'enterprise') return v;
    return 'free';
  }

  // ── Onboarding-nudge write methods (customer-lifecycle Hermes migration) ──
  //
  // The PM2 cron `agent-customer-lifecycle` (scripts/agents/customer-
  // lifecycle.ts) currently owns the writes. These methods mirror its
  // exact behaviour so a Hermes-driven agent can call them via MCP
  // without changing customer-visible semantics. Safeguards are
  // server-side — the agent picks a `nudge_key`, this service decides
  // whether SMTP fires (LIFECYCLE_LIVE), against which addresses
  // (LIFECYCLE_TEST_EMAILS), and whether dedup blocks (existing
  // dayN_NudgeSentAt).

  static readonly NUDGE_COLUMN = {
    'day1-pair-screen': 'day1NudgeSentAt',
    'day3-upload-content': 'day3NudgeSentAt',
    'day7-create-schedule': 'day7NudgeSentAt',
  } as const;

  static readonly NUDGE_SUBJECT = {
    'day1-pair-screen': 'Pair your first screen with Vizora',
    'day3-upload-content': 'Upload your first piece of content',
    'day7-create-schedule': 'Schedule your content for automatic playback',
  } as const;

  /**
   * Set the dayN_NudgeSentAt column. Idempotent — re-calling with the
   * same nudgeKey on an already-sent row returns true (the row is
   * unchanged). Returns false if the org has no onboarding row at all
   * (caller's responsibility to upsert first via auto-complete or
   * sendOnboardingNudge's internal upsert).
   */
  async setOnboardingNudgeSent(
    organizationId: string,
    nudgeKey: keyof typeof OrganizationsService.NUDGE_COLUMN,
  ): Promise<boolean> {
    const col = OrganizationsService.NUDGE_COLUMN[nudgeKey];
    const res = await this.db.organizationOnboarding.upsert({
      where: { organizationId },
      create: { organizationId, [col]: new Date() },
      update: { [col]: new Date() },
      select: { organizationId: true },
    });
    return res.organizationId === organizationId;
  }

  /**
   * Mark an org's onboarding as completed. Used by the auto-complete
   * path for stale (>30d) signups that never finish. Idempotent —
   * re-calling on an already-completed row updates the timestamp,
   * which is fine.
   */
  async setOnboardingCompleted(organizationId: string): Promise<boolean> {
    const res = await this.db.organizationOnboarding.upsert({
      where: { organizationId },
      create: { organizationId, completedAt: new Date() },
      update: { completedAt: new Date() },
      select: { organizationId: true },
    });
    return res.organizationId === organizationId;
  }

  /**
   * Send a templated onboarding nudge. THE TEMPLATE IS HARDCODED
   * SERVER-SIDE — the caller picks a `nudgeKey` and the server picks
   * the subject + body. This is the D6 hardened-outbound rule: agent
   * input never reaches the wire as email content.
   *
   * Resolution rules (mirrors `scripts/agents/customer-lifecycle.ts`):
   * - LIFECYCLE_TEST_EMAILS set → all mail goes to those addresses
   *   (regardless of LIFECYCLE_LIVE). Real admin email is NOT used.
   * - LIFECYCLE_LIVE=true (and TEST_EMAILS empty) → real admin email.
   * - Otherwise → dry-run, no SMTP call.
   *
   * Dedup safety: pre-checks `dayN_NudgeSentAt`. If already set,
   * returns `{ sent: false, reason: 'already_sent' }` WITHOUT firing
   * SMTP. After a successful send, marks the column inside the same
   * call (mirrors the PM2 cron's "send + mark in one logical step"
   * pattern, which is the duplicate-email mitigation).
   *
   * Logging: recipient addresses are sha256-hashed (`maskEmail`) and
   * NEVER logged in plaintext, error messages, or the audit row.
   */
  async sendOnboardingNudge(
    organizationId: string,
    nudgeKey: keyof typeof OrganizationsService.NUDGE_COLUMN,
  ): Promise<{
    sent: boolean;
    recipientCount: number;
    recipientHashes: string[];
    reason:
      | 'sent'
      | 'dry_run'
      | 'already_sent'
      | 'no_admin'
      | 'no_smtp_configured'
      | 'smtp_error';
  }> {
    const col = OrganizationsService.NUDGE_COLUMN[nudgeKey];
    const subject = OrganizationsService.NUDGE_SUBJECT[nudgeKey];

    // Pre-check dedup
    const existing = await this.db.organizationOnboarding.findUnique({
      where: { organizationId },
    });
    if (existing && existing[col] != null) {
      return { sent: false, recipientCount: 0, recipientHashes: [], reason: 'already_sent' };
    }

    // Find admin recipient (the actual customer-facing address)
    const admin = await this.db.user.findFirst({
      where: {
        organizationId,
        role: { in: ['admin', 'manager'] },
        isActive: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { email: true },
    });
    if (!admin?.email) {
      return { sent: false, recipientCount: 0, recipientHashes: [], reason: 'no_admin' };
    }

    // Resolve recipients per the LIFECYCLE_LIVE / LIFECYCLE_TEST_EMAILS rules
    const testEmailsRaw = process.env.LIFECYCLE_TEST_EMAILS || '';
    const testEmails = testEmailsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const live = process.env.LIFECYCLE_LIVE === 'true';
    const recipients =
      testEmails.length > 0 ? [...testEmails] : live ? [admin.email] : [];

    const recipientHashes = recipients.map((e) => OrganizationsService.maskEmail(e));

    if (recipients.length === 0) {
      return { sent: false, recipientCount: 0, recipientHashes: [], reason: 'dry_run' };
    }

    // Build SMTP transporter on demand. Cached on the service instance
    // after first build to avoid re-handshaking per send within the
    // same process lifetime.
    const transporter = await this.getLifecycleTransporter();
    if (!transporter) {
      return {
        sent: false,
        recipientCount: 0,
        recipientHashes: [],
        reason: 'no_smtp_configured',
      };
    }

    const appUrl =
      process.env.APP_URL || process.env.WEB_URL || 'https://vizora.cloud';
    const body = `Hi,\n\n${subject}.\n\nOpen your dashboard: ${appUrl}/dashboard\n\n— Vizora`;
    const from = process.env.EMAIL_FROM || 'Vizora <noreply@mail.vizora.cloud>';

    let sent = 0;
    for (const to of recipients) {
      try {
        await transporter.sendMail({ from, to, subject, text: body });
        sent++;
      } catch (err) {
        // Mask recipient — DO NOT log raw `to` or raw err.message,
        // nodemailer DSN payloads frequently embed the recipient.
        const code = (err as { code?: string })?.code ?? 'UNKNOWN';
        this.logger.warn(
          `lifecycle nudge send failed org=${organizationId} recipient=${OrganizationsService.maskEmail(to)} code=${code}`,
        );
      }
    }

    if (sent === 0) {
      return {
        sent: false,
        recipientCount: 0,
        recipientHashes,
        reason: 'smtp_error',
      };
    }

    // Mark sent in the same logical step (dedup mitigation)
    await this.setOnboardingNudgeSent(organizationId, nudgeKey);

    return {
      sent: true,
      recipientCount: sent,
      recipientHashes,
      reason: 'sent',
    };
  }

  /**
   * Lazy transporter — only built when actually needed, then cached.
   * Returns null if SMTP isn't configured (dev environments).
   */
  private lifecycleTransporter:
    | { sendMail: (opts: Record<string, unknown>) => Promise<unknown> }
    | null
    | undefined = undefined;

  private async getLifecycleTransporter() {
    if (this.lifecycleTransporter !== undefined) return this.lifecycleTransporter;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost || (smtpUser && !smtpPass)) {
      this.lifecycleTransporter = null;
      return null;
    }
    const { default: nodemailer } = await import('nodemailer');
    this.lifecycleTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_PORT || '587') === '465',
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });
    return this.lifecycleTransporter;
  }

  /**
   * Sha256-hash an email so it can appear in audit logs / wire payloads
   * without leaking the plaintext. Same hashing the PM2 cron's
   * `lib/alerting.maskEmail` uses (deterministic — the same address
   * always hashes the same).
   */
  private static maskEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
  }

  async findOne(id: string) {
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            displays: true,
            content: true,
            playlists: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.sanitizeOrg(organization);
  }

  async findBySlug(slug: string) {
    const organization = await this.db.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.sanitizeOrg(organization);
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const org = await this.findOne(id);

    if (updateOrganizationDto.slug) {
      const existing = await this.db.organization.findFirst({
        where: {
          slug: updateOrganizationDto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Organization with this slug already exists');
      }
    }

    // Merge settings with existing to avoid overwriting branding etc.
    const { settings: incomingSettings, ...rest } = updateOrganizationDto;
    const data: Record<string, unknown> = { ...rest };
    if (incomingSettings) {
      const currentSettings = (org.settings as Record<string, unknown>) || {};
      data.settings = { ...currentSettings, ...incomingSettings };
    }

    const updated = await this.db.organization.update({
      where: { id },
      data,
    });
    return this.sanitizeOrg(updated);
  }

  async remove(id: string, requestingUserId?: string) {
    const org = await this.findOne(id);

    // 1. Collect file URLs and user IDs before deletion
    const content = await this.db.content.findMany({
      where: { organizationId: id },
      select: { id: true, url: true },
    });
    const users = await this.db.user.findMany({
      where: { organizationId: id },
      select: { id: true },
    });

    // 2. Cascade delete organization in a transaction (Prisma handles related records)
    await this.db.$transaction(async (tx) => {
      await tx.organization.delete({
        where: { id },
      });
    });

    // 3. Clean up MinIO files (after successful DB delete — orphaned files are
    // safer than deleted files with live DB records)
    for (const item of content) {
      if (item.url?.startsWith('minio://')) {
        const objectKey = item.url.substring('minio://'.length);
        try {
          await this.storageService.deleteFile(objectKey);
        } catch (err) {
          this.logger.warn(`Failed to delete MinIO object ${objectKey}: ${err}`);
        }
      }
    }

    // 4. Clear Redis cache entries for this org's users
    for (const user of users) {
      await this.redisService.del(`user_auth:${user.id}`);
    }

    // 5. Log the deletion
    this.logger.log(
      `Organization ${id} (${org.name}) deleted by user ${requestingUserId ?? 'unknown'}`,
    );
  }

  async getBranding(orgId: string) {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const settings = (org.settings as Record<string, unknown>) || {};
    return settings.branding || {
      name: org.name,
      logoUrl: org.logoUrl,
      primaryColor: '#0284c7',
      secondaryColor: '#38bdf8',
      accentColor: '#0ea5e9',
      fontFamily: 'sans',
      showPoweredBy: true,
      customDomain: '',
      customCSS: '',
    };
  }

  async updateBranding(orgId: string, brandingDto: BrandingConfigDto) {
    // Validate hex colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (brandingDto.primaryColor && !hexColorRegex.test(brandingDto.primaryColor)) {
      throw new BadRequestException('primaryColor must be a valid hex color (e.g., #00E5A0)');
    }
    if (brandingDto.secondaryColor && !hexColorRegex.test(brandingDto.secondaryColor)) {
      throw new BadRequestException('secondaryColor must be a valid hex color (e.g., #38BDF8)');
    }
    if (brandingDto.accentColor && !hexColorRegex.test(brandingDto.accentColor)) {
      throw new BadRequestException('accentColor must be a valid hex color (e.g., #0EA5E9)');
    }

    const org = await this.findOne(orgId);
    if (brandingDto.customCSS) {
      brandingDto.customCSS = this.sanitizeCSS(brandingDto.customCSS);
    }
    const currentSettings = (org.settings as Record<string, unknown>) || {};
    const updated = await this.db.organization.update({
      where: { id: orgId },
      data: {
        settings: { ...currentSettings, branding: brandingDto },
      },
    });
    return this.sanitizeOrg(updated);
  }

  async uploadLogo(orgId: string, file: Express.Multer.File) {
    await this.findOne(orgId);
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const objectKey = `branding/${orgId}/logo.${ext}`;

    if (this.storageService.isMinioAvailable()) {
      await this.storageService.uploadFile(file.buffer, objectKey, file.mimetype);
      const logoUrl = `minio://${objectKey}`;
      await this.db.organization.update({
        where: { id: orgId },
        data: { logoUrl },
      });
      return { logoUrl, objectKey };
    } else {
      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads', 'branding');
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, `${orgId}-logo.${ext}`);
      await fs.promises.writeFile(filePath, file.buffer);
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const logoUrl = `${baseUrl}/uploads/branding/${orgId}-logo.${ext}`;
      await this.db.organization.update({
        where: { id: orgId },
        data: { logoUrl },
      });
      return { logoUrl };
    }
  }

  private sanitizeCSS(css: string): string {
    const dangerous = [
      /@import\b/gi,
      /expression\s*\(/gi,
      /javascript\s*:/gi,
      /behavior\s*:/gi,
      /-moz-binding\s*:/gi,
      /url\s*\(\s*['"]?\s*(?!https?:\/\/|data:)/gi,
    ];
    let sanitized = css;
    for (const pattern of dangerous) {
      sanitized = sanitized.replace(pattern, '/* blocked */');
    }
    return sanitized;
  }
}
