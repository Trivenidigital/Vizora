import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
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
    const where: any = {};

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
    const updateData: any = {};
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
    const where: any = {};
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
