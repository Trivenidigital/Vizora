import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportClassifierService } from './support-classifier.service';
import { SupportKnowledgeService } from './support-knowledge.service';

interface CreateRequestInput {
  message: string;
  context?: {
    pageUrl?: string;
    browserInfo?: string;
    consoleErrors?: string;
  };
}

interface SupportFilters {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface UserInfo {
  id: string;
  organizationId: string;
  role: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly classifier: SupportClassifierService,
    private readonly knowledgeBase: SupportKnowledgeService,
  ) {}

  /**
   * Create a new support request with auto-classification and response
   */
  async createRequest(userId: string, organizationId: string, input: CreateRequestInput) {
    const { message, context } = input;

    // Classify the message
    const { category, priority } = this.classifier.classify(message);

    // Try knowledge base first
    const kbResult = this.knowledgeBase.search(message);

    // Generate metadata
    const title = this.classifier.generateTitle(message);
    const aiSummary = this.classifier.generateSummary(message, category);
    const aiSuggestedAction = this.classifier.suggestAction(category, priority);

    // Create the support request
    const request = await this.db.supportRequest.create({
      data: {
        organizationId,
        userId,
        category,
        priority,
        status: 'open',
        title,
        description: message,
        aiSummary,
        aiSuggestedAction,
        pageUrl: context?.pageUrl,
        browserInfo: context?.browserInfo,
        consoleErrors: context?.consoleErrors,
      },
    });

    const requestNumber = request.id.substring(0, 8).toUpperCase();

    // Create the user's initial message
    await this.db.supportMessage.create({
      data: {
        requestId: request.id,
        organizationId,
        userId,
        role: 'user',
        content: message,
      },
    });

    // Generate and save the assistant response
    const responseText = this.generateResponse(category, priority, requestNumber, kbResult?.answer);

    await this.db.supportMessage.create({
      data: {
        requestId: request.id,
        organizationId,
        userId, // system message attributed to the user's context
        role: 'assistant',
        content: responseText,
      },
    });

    // Notify admin if critical or high priority
    if (priority === 'critical' || priority === 'high') {
      try {
        await this.notificationsService.create({
          title: `${priority === 'critical' ? 'URGENT' : 'High Priority'} Support Request #${requestNumber}`,
          message: `[${category.replace(/_/g, ' ')}] ${title}`,
          type: 'system',
          severity: priority === 'critical' ? 'critical' : 'warning',
          organizationId,
        });
      } catch (error) {
        this.logger.warn(`Failed to create notification for support request ${request.id}: ${error}`);
      }
    }

    this.logger.log(`Created support request ${request.id} (${category}/${priority}) for org ${organizationId}`);

    return {
      request,
      responseText,
      requestNumber,
    };
  }

  /**
   * List support requests with filtering and pagination
   */
  async findAll(user: UserInfo, filters: SupportFilters) {
    const { page = 1, limit = 20, status, priority, category, search } = filters;
    const skip = (page - 1) * limit;

    // Build where clause with proper access control
    const where: Prisma.SupportRequestWhereInput = {};

    if (user.isSuperAdmin) {
      // SuperAdmin sees all requests — no org filter unless we add one later
    } else if (user.role === 'admin') {
      // Org admin sees all requests in their org
      where.organizationId = user.organizationId;
    } else {
      // Regular users see only their own requests
      where.organizationId = user.organizationId;
      where.userId = user.id;
    }

    // Apply filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.supportRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.db.supportRequest.count({ where }),
    ]);

    // Add request numbers
    const requests = data.map(r => ({
      ...r,
      requestNumber: r.id.substring(0, 8).toUpperCase(),
    }));

    return {
      data: requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List open support requests as TRIAGE CANDIDATES — returns precomputed
   * structural signals only (word count, has-attachment, message count,
   * age, org tier). The description body and any user PII NEVER cross
   * this method's return boundary, so a downstream LLM-driven agent
   * (Hermes / MCP tool) can safely consume the output without violating
   * D13 (no raw user data into LLM prompts — see scripts/agents/lib/
   * types.ts for the original constraint).
   *
   * Different from `findAll`:
   *  - Always scoped to one orgId (no super-admin escape; MCP tokens are
   *    per-org-scoped at issuance, this method matches that contract).
   *  - Default WHERE excludes any request that already has an
   *    `authorType='agent'` message (D7 reply-loop prevention) — the
   *    same exclusion the existing `support-triage` cron uses.
   *  - Returns NO `description`, NO `consoleErrors`, NO user joins.
   *  - Word count + has_attachment computed server-side.
   */
  async listTriageCandidates(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      includeAlreadyTriaged?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 20, includeAlreadyTriaged = false } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportRequestWhereInput = {
      organizationId,
      status: 'open',
    };
    if (!includeAlreadyTriaged) {
      where.messages = { none: { authorType: 'agent' } };
    }

    const [rows, total] = await Promise.all([
      this.db.supportRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          organizationId: true,
          status: true,
          priority: true,
          category: true,
          aiCategory: true,
          createdAt: true,
          // Selected purely to compute structural signals server-side —
          // these fields are stripped before returning.
          description: true,
          consoleErrors: true,
          organization: { select: { subscriptionTier: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.db.supportRequest.count({ where }),
    ]);

    const now = Date.now();
    const data = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      status: r.status,
      priority: r.priority,
      category: r.category,
      aiCategory: r.aiCategory,
      createdAt: r.createdAt,
      ageMinutes: Math.floor((now - r.createdAt.getTime()) / 60_000),
      // Structural signals only — body never on the wire.
      wordCount: (r.description ?? '').trim().split(/\s+/).filter(Boolean)
        .length,
      hasAttachment: Boolean(r.consoleErrors && r.consoleErrors.length > 0),
      messageCount: r._count.messages,
      orgTier: r.organization?.subscriptionTier ?? 'free',
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Set the `priority` of a support request — agent-driven path.
   *
   * Used by Hermes (and the legacy PM2 cron) to escalate or de-escalate
   * tickets after triage scoring. Cross-org guard via `updateMany`'s
   * compound where (id + organizationId) ensures a token scoped to one
   * org cannot mutate a request belonging to another org even if it
   * gets the id wrong.
   *
   * Returns true if exactly one row was updated, false if no row
   * matched (deleted, wrong org, etc).
   */
  async setRequestPriority(
    organizationId: string,
    requestId: string,
    priority: 'urgent' | 'high' | 'normal' | 'low',
  ): Promise<boolean> {
    const res = await this.db.supportRequest.updateMany({
      where: { id: requestId, organizationId },
      data: { priority },
    });
    return res.count === 1;
  }

  /**
   * Set the `aiCategory` (V2 taxonomy slug) of a support request.
   * Idempotent for the same value — Prisma treats no-change updates
   * as 1-row updates. This matches the existing PM2 cron's behavior.
   */
  async setRequestAiCategory(
    organizationId: string,
    requestId: string,
    aiCategory: string,
  ): Promise<boolean> {
    const res = await this.db.supportRequest.updateMany({
      where: { id: requestId, organizationId },
      data: { aiCategory },
    });
    return res.count === 1;
  }

  /**
   * Append an agent-authored message to a support request's thread.
   *
   * `userId` is the original submitter (kept for attribution + access
   * control on the messages API). The agent identity rides on
   * `authorType='agent'`. The MCP tool layer passes the agent name
   * from the bearer-token context for audit purposes; we do NOT
   * persist that here — the audit trail lives in `mcp_audit_log`.
   *
   * Refuses to write if the request doesn't belong to the named org
   * (cross-org guard).
   */
  async createAgentMessage(
    organizationId: string,
    requestId: string,
    content: string,
  ): Promise<{ id: string; createdAt: Date } | null> {
    const req = await this.db.supportRequest.findFirst({
      where: { id: requestId, organizationId },
      select: { id: true, userId: true },
    });
    if (!req) return null;

    const created = await this.db.supportMessage.create({
      data: {
        requestId: req.id,
        organizationId,
        userId: req.userId,
        role: 'assistant',
        authorType: 'agent',
        content,
      },
      select: { id: true, createdAt: true },
    });
    return created;
  }

  /**
   * Get a single support request with messages
   */
  async findOne(id: string, user: UserInfo) {
    const request = await this.db.supportRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        resolvedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    // Access control
    if (!user.isSuperAdmin) {
      if (request.organizationId !== user.organizationId) {
        throw new ForbiddenException('Access denied');
      }
      if (user.role !== 'admin' && request.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      ...request,
      requestNumber: request.id.substring(0, 8).toUpperCase(),
    };
  }

  /**
   * Update a support request (admin/superadmin only)
   */
  async update(id: string, organizationId: string, isSuperAdmin: boolean, data: {
    status?: string;
    priority?: string;
    resolutionNotes?: string;
    resolvedById?: string;
    resolvedAt?: Date;
  }) {
    const request = await this.db.supportRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    // Access control
    if (!isSuperAdmin && request.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    // Build update data
    const updateData: Prisma.SupportRequestUpdateInput = {};
    if (data.status) updateData.status = data.status;
    if (data.priority) updateData.priority = data.priority;
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;

    // If resolving, set resolved metadata
    if (data.status === 'resolved' || data.status === 'closed') {
      if (data.resolvedById) updateData.resolvedById = data.resolvedById;
      if (!request.resolvedAt) updateData.resolvedAt = new Date();
    }

    const updated = await this.db.supportRequest.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Updated support request ${id}: ${JSON.stringify(data)}`);

    return {
      ...updated,
      requestNumber: updated.id.substring(0, 8).toUpperCase(),
    };
  }

  /**
   * Add a message to a support request
   */
  async addMessage(
    requestId: string,
    user: UserInfo,
    content: string,
  ) {
    const request = await this.db.supportRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    // Access control
    if (!user.isSuperAdmin) {
      if (request.organizationId !== user.organizationId) {
        throw new ForbiddenException('Access denied');
      }
      if (user.role !== 'admin' && request.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Determine role based on user
    const role = (user.role === 'admin' || user.isSuperAdmin) ? 'admin' : 'user';

    const message = await this.db.supportMessage.create({
      data: {
        requestId,
        organizationId: request.organizationId,
        userId: user.id,
        role,
        content,
      },
    });

    // If the request was resolved/closed and user sends a new message, reopen it
    if (role === 'user' && (request.status === 'resolved' || request.status === 'closed')) {
      await this.db.supportRequest.update({
        where: { id: requestId },
        data: { status: 'open' },
      });
      this.logger.log(`Reopened support request ${requestId} due to new user message`);
    }

    this.logger.log(`Added ${role} message to support request ${requestId}`);

    return message;
  }

  /**
   * Get support statistics (admin/superadmin only)
   */
  async getStats(organizationId: string, isSuperAdmin: boolean) {
    const where: Prisma.SupportRequestWhereInput = {};
    if (!isSuperAdmin) {
      where.organizationId = organizationId;
    }

    // Get counts by status
    const [
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
    ] = await Promise.all([
      this.db.supportRequest.count({ where: { ...where, status: 'open' } }),
      this.db.supportRequest.count({ where: { ...where, status: 'in_progress' } }),
      this.db.supportRequest.count({ where: { ...where, status: 'resolved' } }),
      this.db.supportRequest.count({ where: { ...where, status: 'closed' } }),
    ]);

    // Get counts by category
    const categories = ['bug_report', 'feature_request', 'help_question', 'template_request', 'feedback', 'urgent_issue', 'account_issue'];
    const categoryCounts: Record<string, number> = {};
    for (const cat of categories) {
      categoryCounts[cat] = await this.db.supportRequest.count({ where: { ...where, category: cat } });
    }

    // Get counts by priority
    const priorities = ['critical', 'high', 'medium', 'low'];
    const priorityCounts: Record<string, number> = {};
    for (const pri of priorities) {
      priorityCounts[pri] = await this.db.supportRequest.count({ where: { ...where, priority: pri } });
    }

    // Resolved this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const resolvedThisWeek = await this.db.supportRequest.count({
      where: {
        ...where,
        status: { in: ['resolved', 'closed'] },
        resolvedAt: { gte: weekAgo },
      },
    });

    return {
      byStatus: {
        open: openCount,
        in_progress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount,
      },
      byCategory: categoryCounts,
      byPriority: priorityCounts,
      resolvedThisWeek,
      total: openCount + inProgressCount + resolvedCount + closedCount,
    };
  }

  /**
   * Generate a template response based on category and knowledge base
   */
  private generateResponse(category: string, priority: string, requestNumber: string, kbAnswer?: string): string {
    if (kbAnswer) return kbAnswer;

    const templates: Record<string, string> = {
      bug_report: `I've logged this as bug report **#${requestNumber}**. ${
        priority === 'critical'
          ? 'This has been flagged as **high priority** and the admin team has been notified immediately.'
          : 'Our team typically reviews bug reports within 24-48 hours.'
      }\n\nIn the meantime, try refreshing the page or clearing your browser cache.`,
      feature_request: `Great suggestion! I've logged this as feature request **#${requestNumber}**. We review all requests and prioritize based on user demand. Your feedback directly shapes Vizora's roadmap!`,
      template_request: `I've noted your template request **#${requestNumber}**! You can also try our **AI Designer** — go to Templates and click "New Design" → "AI Designer" to describe what you need.`,
      feedback: `Thank you for the kind words! Your feedback means a lot to our team. We're glad you're enjoying Vizora!`,
      account_issue: `I understand you're having an account issue. I've flagged this as **high priority** (**#${requestNumber}**) and the admin team has been notified. They'll assist you shortly.`,
      urgent_issue: `This has been flagged as **URGENT** (**#${requestNumber}**). The admin team has been **immediately notified**. We're looking into this right away.`,
      help_question: `I've logged your question as **#${requestNumber}**. Our team will get back to you. In the meantime, you can explore the dashboard — most features are designed to be intuitive!`,
    };

    return templates[category] || templates.help_question;
  }
}
