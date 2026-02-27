import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupportService } from './support.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportClassifierService } from './support-classifier.service';
import { SupportKnowledgeService } from './support-knowledge.service';

describe('SupportService', () => {
  let service: SupportService;
  let db: any;
  let notificationsService: any;
  let classifier: any;
  let knowledgeBase: any;

  const orgId = 'org-123';
  const userId = 'user-123';

  const mockRequest = {
    id: 'req-12345678-abcd',
    organizationId: orgId,
    userId,
    category: 'bug_report',
    priority: 'medium',
    status: 'open',
    title: 'The app keeps crashing',
    description: 'The app keeps crashing when I open settings',
    aiSummary: '[BUG REPORT] The app keeps crashing when I open settings',
    aiSuggestedAction: 'Investigate the reported issue and attempt to reproduce it.',
    pageUrl: null,
    browserInfo: null,
    consoleErrors: null,
    resolvedAt: null,
    resolvedById: null,
    createdAt: new Date('2026-01-01'),
  };

  const mockMessage = {
    id: 'msg-1',
    requestId: mockRequest.id,
    organizationId: orgId,
    userId,
    role: 'user',
    content: 'The app keeps crashing when I open settings',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    db = {
      supportRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      supportMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    notificationsService = {
      create: jest.fn(),
    };

    classifier = {
      classify: jest.fn(),
      generateTitle: jest.fn(),
      generateSummary: jest.fn(),
      suggestAction: jest.fn(),
    };

    knowledgeBase = {
      search: jest.fn(),
    };

    service = new SupportService(
      db as unknown as DatabaseService,
      notificationsService as unknown as NotificationsService,
      classifier as unknown as SupportClassifierService,
      knowledgeBase as unknown as SupportKnowledgeService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    beforeEach(() => {
      classifier.classify.mockReturnValue({ category: 'bug_report', priority: 'medium' });
      classifier.generateTitle.mockReturnValue('The app keeps crashing');
      classifier.generateSummary.mockReturnValue('[BUG REPORT] The app keeps crashing');
      classifier.suggestAction.mockReturnValue('Investigate the reported issue and attempt to reproduce it.');
      knowledgeBase.search.mockReturnValue(null);
      db.supportRequest.create.mockResolvedValue(mockRequest);
      db.supportMessage.create.mockResolvedValue(mockMessage);
    });

    it('should create request, user message, and assistant message', async () => {
      const result = await service.createRequest(userId, orgId, {
        message: 'The app keeps crashing when I open settings',
      });

      expect(result.request).toEqual(mockRequest);
      expect(result.requestNumber).toBe(mockRequest.id.substring(0, 8).toUpperCase());
      expect(db.supportRequest.create).toHaveBeenCalledTimes(1);
      expect(db.supportMessage.create).toHaveBeenCalledTimes(2);

      // First call: user message
      expect(db.supportMessage.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          requestId: mockRequest.id,
          role: 'user',
          content: 'The app keeps crashing when I open settings',
        }),
      });

      // Second call: assistant message
      expect(db.supportMessage.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          requestId: mockRequest.id,
          role: 'assistant',
        }),
      });
    });

    it('should call classifier service', async () => {
      await service.createRequest(userId, orgId, {
        message: 'The app keeps crashing',
      });

      expect(classifier.classify).toHaveBeenCalledWith('The app keeps crashing');
      expect(classifier.generateTitle).toHaveBeenCalledWith('The app keeps crashing');
      expect(classifier.generateSummary).toHaveBeenCalledWith('The app keeps crashing', 'bug_report');
      expect(classifier.suggestAction).toHaveBeenCalledWith('bug_report', 'medium');
    });

    it('should search knowledge base', async () => {
      await service.createRequest(userId, orgId, {
        message: 'how do I pair a device',
      });

      expect(knowledgeBase.search).toHaveBeenCalledWith('how do I pair a device');
    });

    it('should send notification for critical priority', async () => {
      classifier.classify.mockReturnValue({ category: 'urgent_issue', priority: 'critical' });
      notificationsService.create.mockResolvedValue({});

      await service.createRequest(userId, orgId, {
        message: 'all devices are down!',
      });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          severity: 'critical',
          organizationId: orgId,
        }),
      );
    });

    it('should send notification for high priority', async () => {
      classifier.classify.mockReturnValue({ category: 'account_issue', priority: 'high' });
      notificationsService.create.mockResolvedValue({});

      await service.createRequest(userId, orgId, {
        message: "can't access my account",
      });

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          severity: 'warning',
          organizationId: orgId,
        }),
      );
    });

    it('should NOT send notification for medium priority', async () => {
      classifier.classify.mockReturnValue({ category: 'bug_report', priority: 'medium' });

      await service.createRequest(userId, orgId, {
        message: 'something is wrong with the display',
      });

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('should NOT send notification for low priority', async () => {
      classifier.classify.mockReturnValue({ category: 'help_question', priority: 'low' });

      await service.createRequest(userId, orgId, {
        message: 'how do I use templates',
      });

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('should include context data when provided', async () => {
      await service.createRequest(userId, orgId, {
        message: 'The app crashed',
        context: {
          pageUrl: '/dashboard/devices',
          browserInfo: 'Chrome 120',
          consoleErrors: 'TypeError: null',
        },
      });

      expect(db.supportRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pageUrl: '/dashboard/devices',
          browserInfo: 'Chrome 120',
          consoleErrors: 'TypeError: null',
        }),
      });
    });

    it('should use knowledge base answer when available', async () => {
      knowledgeBase.search.mockReturnValue({
        id: 'pair_device',
        keywords: ['pair', 'device'],
        question: 'How do I pair a device?',
        answer: 'To pair a device, go to Devices page...',
      });

      const result = await service.createRequest(userId, orgId, {
        message: 'how do I pair a device',
      });

      expect(result.responseText).toBe('To pair a device, go to Devices page...');
    });
  });

  describe('findAll', () => {
    const adminUser = {
      id: userId,
      organizationId: orgId,
      role: 'admin',
      isSuperAdmin: false,
    };

    const superAdminUser = {
      id: userId,
      organizationId: orgId,
      role: 'admin',
      isSuperAdmin: true,
    };

    const regularUser = {
      id: userId,
      organizationId: orgId,
      role: 'viewer',
      isSuperAdmin: false,
    };

    beforeEach(() => {
      db.supportRequest.findMany.mockResolvedValue([mockRequest]);
      db.supportRequest.count.mockResolvedValue(1);
    });

    it('should filter by organizationId for non-superadmin admin', async () => {
      await service.findAll(adminUser, {});

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });

    it('should return all for superadmin (no org filter)', async () => {
      await service.findAll(superAdminUser, {});

      const call = db.supportRequest.findMany.mock.calls[0][0];
      expect(call.where.organizationId).toBeUndefined();
    });

    it('should filter by userId for non-admin', async () => {
      await service.findAll(regularUser, {});

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            userId,
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      await service.findAll(adminUser, { status: 'open' });

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'open',
          }),
        }),
      );
    });

    it('should apply priority filter', async () => {
      await service.findAll(adminUser, { priority: 'high' });

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: 'high',
          }),
        }),
      );
    });

    it('should apply category filter', async () => {
      await service.findAll(adminUser, { category: 'bug_report' });

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'bug_report',
          }),
        }),
      );
    });

    it('should apply search filter', async () => {
      await service.findAll(adminUser, { search: 'crash' });

      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'crash', mode: 'insensitive' } },
              { description: { contains: 'crash', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should return paginated results with meta', async () => {
      db.supportRequest.findMany.mockResolvedValue([mockRequest]);
      db.supportRequest.count.mockResolvedValue(25);

      const result = await service.findAll(adminUser, { page: 2, limit: 10 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(db.supportRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should add requestNumber to each result', async () => {
      const result = await service.findAll(adminUser, {});

      expect(result.data[0]).toHaveProperty('requestNumber');
      expect(result.data[0].requestNumber).toBe(mockRequest.id.substring(0, 8).toUpperCase());
    });
  });

  describe('findOne', () => {
    const adminUser = {
      id: userId,
      organizationId: orgId,
      role: 'admin',
      isSuperAdmin: false,
    };

    it('should return request with messages', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        resolvedBy: null,
        messages: [mockMessage],
      });

      const result = await service.findOne(mockRequest.id, adminUser);

      expect(result).toBeDefined();
      expect(result.requestNumber).toBe(mockRequest.id.substring(0, 8).toUpperCase());
      expect(db.supportRequest.findUnique).toHaveBeenCalledWith({
        where: { id: mockRequest.id },
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
    });

    it('should throw NotFoundException for non-existent request', async () => {
      db.supportRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for wrong org (non-superadmin)', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        organizationId: 'other-org',
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        resolvedBy: null,
        messages: [],
      });

      await expect(service.findOne(mockRequest.id, adminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for non-admin accessing another user request', async () => {
      const viewerUser = {
        id: 'other-user',
        organizationId: orgId,
        role: 'viewer',
        isSuperAdmin: false,
      };

      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        resolvedBy: null,
        messages: [],
      });

      await expect(service.findOne(mockRequest.id, viewerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow superadmin to access any request', async () => {
      const superAdmin = {
        id: 'admin-user',
        organizationId: 'different-org',
        role: 'admin',
        isSuperAdmin: true,
      };

      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        resolvedBy: null,
        messages: [],
      });

      const result = await service.findOne(mockRequest.id, superAdmin);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update status and priority', async () => {
      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'in_progress',
        priority: 'high',
      });

      const result = await service.update(mockRequest.id, orgId, false, {
        status: 'in_progress',
        priority: 'high',
      });

      expect(result.status).toBe('in_progress');
      expect(result.priority).toBe('high');
      expect(db.supportRequest.update).toHaveBeenCalledWith({
        where: { id: mockRequest.id },
        data: expect.objectContaining({
          status: 'in_progress',
          priority: 'high',
        }),
      });
    });

    it('should set resolvedById and resolvedAt when status is resolved', async () => {
      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'resolved',
        resolvedById: 'admin-user',
        resolvedAt: new Date(),
      });

      await service.update(mockRequest.id, orgId, false, {
        status: 'resolved',
        resolvedById: 'admin-user',
      });

      expect(db.supportRequest.update).toHaveBeenCalledWith({
        where: { id: mockRequest.id },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedById: 'admin-user',
          resolvedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundException for non-existent request', async () => {
      db.supportRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', orgId, false, { status: 'resolved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong org (non-superadmin)', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        organizationId: 'other-org',
      });

      await expect(
        service.update(mockRequest.id, orgId, false, { status: 'resolved' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow superadmin to update any request', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        organizationId: 'other-org',
      });
      db.supportRequest.update.mockResolvedValue({
        ...mockRequest,
        organizationId: 'other-org',
        status: 'resolved',
      });

      const result = await service.update(mockRequest.id, orgId, true, { status: 'resolved' });
      expect(result).toBeDefined();
    });

    it('should add requestNumber to the returned result', async () => {
      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportRequest.update.mockResolvedValue(mockRequest);

      const result = await service.update(mockRequest.id, orgId, false, { status: 'in_progress' });
      expect(result.requestNumber).toBe(mockRequest.id.substring(0, 8).toUpperCase());
    });
  });

  describe('addMessage', () => {
    const regularUser = {
      id: userId,
      organizationId: orgId,
      role: 'viewer',
      isSuperAdmin: false,
    };

    const adminUser = {
      id: userId,
      organizationId: orgId,
      role: 'admin',
      isSuperAdmin: false,
    };

    it('should create message with user role for regular users', async () => {
      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportMessage.create.mockResolvedValue({
        ...mockMessage,
        role: 'user',
        content: 'Any update on this?',
      });

      const result = await service.addMessage(mockRequest.id, regularUser, 'Any update on this?');

      expect(result.role).toBe('user');
      expect(db.supportMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'user',
          content: 'Any update on this?',
        }),
      });
    });

    it('should create message with admin role for admins', async () => {
      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportMessage.create.mockResolvedValue({
        ...mockMessage,
        role: 'admin',
        content: 'We are looking into it.',
      });

      const result = await service.addMessage(mockRequest.id, adminUser, 'We are looking into it.');

      expect(result.role).toBe('admin');
      expect(db.supportMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'admin',
          content: 'We are looking into it.',
        }),
      });
    });

    it('should create message with admin role for superadmin', async () => {
      const superAdmin = {
        id: 'super-admin',
        organizationId: 'other-org',
        role: 'viewer',
        isSuperAdmin: true,
      };

      db.supportRequest.findUnique.mockResolvedValue(mockRequest);
      db.supportMessage.create.mockResolvedValue({
        ...mockMessage,
        role: 'admin',
        content: 'Escalated.',
      });

      await service.addMessage(mockRequest.id, superAdmin, 'Escalated.');

      expect(db.supportMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'admin',
        }),
      });
    });

    it('should throw NotFoundException for non-existent request', async () => {
      db.supportRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.addMessage('nonexistent-id', regularUser, 'message'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong org (non-superadmin)', async () => {
      const otherOrgUser = {
        id: 'other-user',
        organizationId: 'other-org',
        role: 'admin',
        isSuperAdmin: false,
      };

      db.supportRequest.findUnique.mockResolvedValue(mockRequest);

      await expect(
        service.addMessage(mockRequest.id, otherOrgUser, 'message'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reopen a resolved request when a user sends a message', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: 'resolved',
      });
      db.supportMessage.create.mockResolvedValue(mockMessage);
      db.supportRequest.update.mockResolvedValue({ ...mockRequest, status: 'open' });

      await service.addMessage(mockRequest.id, regularUser, 'Still having issues');

      expect(db.supportRequest.update).toHaveBeenCalledWith({
        where: { id: mockRequest.id },
        data: { status: 'open' },
      });
    });

    it('should NOT reopen a resolved request when an admin sends a message', async () => {
      db.supportRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: 'resolved',
      });
      db.supportMessage.create.mockResolvedValue({ ...mockMessage, role: 'admin' });

      await service.addMessage(mockRequest.id, adminUser, 'This was fixed');

      expect(db.supportRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct counts for non-superadmin', async () => {
      // Status counts
      db.supportRequest.count
        .mockResolvedValueOnce(5)   // open
        .mockResolvedValueOnce(3)   // in_progress
        .mockResolvedValueOnce(10)  // resolved
        .mockResolvedValueOnce(2)   // closed
        // Category counts (7 categories)
        .mockResolvedValueOnce(4)   // bug_report
        .mockResolvedValueOnce(2)   // feature_request
        .mockResolvedValueOnce(3)   // help_question
        .mockResolvedValueOnce(1)   // template_request
        .mockResolvedValueOnce(1)   // feedback
        .mockResolvedValueOnce(1)   // urgent_issue
        .mockResolvedValueOnce(0)   // account_issue
        // Priority counts (4 priorities)
        .mockResolvedValueOnce(1)   // critical
        .mockResolvedValueOnce(3)   // high
        .mockResolvedValueOnce(8)   // medium
        .mockResolvedValueOnce(8)   // low
        // resolvedThisWeek
        .mockResolvedValueOnce(7);

      const result = await service.getStats(orgId, false);

      expect(result.byStatus).toEqual({
        open: 5,
        in_progress: 3,
        resolved: 10,
        closed: 2,
      });
      expect(result.total).toBe(20);
      expect(result.byCategory.bug_report).toBe(4);
      expect(result.byPriority.critical).toBe(1);
      expect(result.resolvedThisWeek).toBe(7);

      // Verify org filter was applied
      expect(db.supportRequest.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });

    it('should return all counts for superadmin (no org filter)', async () => {
      // Return 0 for all counts
      db.supportRequest.count.mockResolvedValue(0);

      const result = await service.getStats(orgId, true);

      expect(result.byStatus).toEqual({
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      });
      expect(result.total).toBe(0);

      // Verify NO org filter was applied for the first call (open status)
      const firstCall = db.supportRequest.count.mock.calls[0][0];
      expect(firstCall.where.organizationId).toBeUndefined();
    });
  });
});
