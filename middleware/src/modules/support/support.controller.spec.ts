import { Test, TestingModule } from '@nestjs/testing';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  let controller: SupportController;
  let supportService: jest.Mocked<SupportService>;

  const mockUser = {
    id: 'user-123',
    organizationId: 'org-123',
    role: 'admin',
    isSuperAdmin: false,
    email: 'test@example.com',
  };

  const mockRequest = {
    id: 'req-12345678-abcd',
    organizationId: 'org-123',
    userId: 'user-123',
    category: 'bug_report',
    priority: 'medium',
    status: 'open',
    title: 'App keeps crashing',
    description: 'The app keeps crashing',
    requestNumber: 'REQ-1234',
  };

  beforeEach(async () => {
    const mockSupportService = {
      createRequest: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      addMessage: jest.fn(),
      getStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: mockSupportService,
        },
      ],
    }).compile();

    controller = module.get<SupportController>(SupportController);
    supportService = module.get(SupportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /support/requests', () => {
    it('should call service.createRequest with correct params', async () => {
      const dto = {
        message: 'The app keeps crashing',
        context: { pageUrl: '/dashboard', browserInfo: 'Chrome 120' },
      };

      supportService.createRequest.mockResolvedValue({
        request: mockRequest as any,
        responseText: 'We have received your request.',
        requestNumber: 'REQ-1234',
      });

      const result = await controller.createRequest('user-123', 'org-123', dto);

      expect(supportService.createRequest).toHaveBeenCalledWith('user-123', 'org-123', {
        message: 'The app keeps crashing',
        context: { pageUrl: '/dashboard', browserInfo: 'Chrome 120' },
      });
      expect(result.request).toEqual(mockRequest);
      expect(result.responseText).toBeDefined();
    });
  });

  describe('GET /support/requests', () => {
    it('should call service.findAll with correct params', async () => {
      const query = { status: 'open', page: 1, limit: 20 };

      supportService.findAll.mockResolvedValue({
        data: [mockRequest] as any,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.findAll(mockUser, query as any);

      expect(supportService.findAll).toHaveBeenCalledWith(
        {
          id: 'user-123',
          organizationId: 'org-123',
          role: 'admin',
          isSuperAdmin: false,
        },
        query,
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should pass isSuperAdmin as false when undefined', async () => {
      const userWithoutSuper = { ...mockUser, isSuperAdmin: undefined };

      supportService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.findAll(userWithoutSuper, {} as any);

      expect(supportService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isSuperAdmin: false,
        }),
        expect.anything(),
      );
    });
  });

  describe('GET /support/requests/:id', () => {
    it('should call service.findOne', async () => {
      supportService.findOne.mockResolvedValue({
        ...mockRequest,
        messages: [],
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        resolvedBy: null,
      } as any);

      const result = await controller.findOne('req-12345678-abcd', mockUser);

      expect(supportService.findOne).toHaveBeenCalledWith('req-12345678-abcd', {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        isSuperAdmin: false,
      });
      expect(result).toBeDefined();
    });
  });

  describe('PATCH /support/requests/:id', () => {
    it('should call service.update with correct params', async () => {
      const dto = { status: 'resolved' as const, priority: 'high' as const };

      supportService.update.mockResolvedValue({
        ...mockRequest,
        status: 'resolved',
        priority: 'high',
      } as any);

      const result = await controller.update(
        'req-12345678-abcd',
        'org-123',
        false,
        'user-123',
        dto,
      );

      expect(supportService.update).toHaveBeenCalledWith(
        'req-12345678-abcd',
        'org-123',
        false,
        expect.objectContaining({
          status: 'resolved',
          priority: 'high',
          resolvedById: 'user-123', // because status is 'resolved'
        }),
      );
      expect(result.status).toBe('resolved');
    });

    it('should not pass resolvedById for non-resolved status', async () => {
      const dto = { status: 'in_progress' as const };

      supportService.update.mockResolvedValue({
        ...mockRequest,
        status: 'in_progress',
      } as any);

      await controller.update('req-12345678-abcd', 'org-123', false, 'user-123', dto);

      expect(supportService.update).toHaveBeenCalledWith(
        'req-12345678-abcd',
        'org-123',
        false,
        expect.objectContaining({
          status: 'in_progress',
          resolvedById: undefined,
        }),
      );
    });
  });

  describe('POST /support/requests/:id/messages', () => {
    it('should call service.addMessage with correct params', async () => {
      const dto = { content: 'Any update on this?' };

      supportService.addMessage.mockResolvedValue({
        id: 'msg-1',
        requestId: 'req-12345678-abcd',
        organizationId: 'org-123',
        userId: 'user-123',
        role: 'admin',
        content: 'Any update on this?',
        createdAt: new Date(),
      } as any);

      const result = await controller.addMessage('req-12345678-abcd', mockUser, dto);

      expect(supportService.addMessage).toHaveBeenCalledWith(
        'req-12345678-abcd',
        {
          id: 'user-123',
          organizationId: 'org-123',
          role: 'admin',
          isSuperAdmin: false,
        },
        'Any update on this?',
      );
      expect(result.content).toBe('Any update on this?');
    });
  });

  describe('GET /support/stats', () => {
    it('should call service.getStats with correct params', async () => {
      const mockStats = {
        byStatus: { open: 5, in_progress: 3, resolved: 10, closed: 2 },
        byCategory: { bug_report: 4 },
        byPriority: { critical: 1 },
        resolvedThisWeek: 7,
        total: 20,
      };

      supportService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('org-123', false);

      expect(supportService.getStats).toHaveBeenCalledWith('org-123', false);
      expect(result.total).toBe(20);
      expect(result.byStatus.open).toBe(5);
    });

    it('should pass isSuperAdmin as false when undefined', async () => {
      supportService.getStats.mockResolvedValue({
        byStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
        byCategory: {},
        byPriority: {},
        resolvedThisWeek: 0,
        total: 0,
      });

      await controller.getStats('org-123', undefined as any);

      expect(supportService.getStats).toHaveBeenCalledWith('org-123', false);
    });
  });
});
