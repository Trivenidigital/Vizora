import { Test, TestingModule } from '@nestjs/testing';
import { AlertRulesController } from './alert-rules.controller';
import { AlertRulesService } from './alert-rules.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('AlertRulesController', () => {
  let controller: AlertRulesController;
  let service: jest.Mocked<AlertRulesService>;

  const orgId = 'org-123';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addRecipient: jest.fn(),
      removeRecipient: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertRulesController],
      providers: [
        { provide: AlertRulesService, useValue: service },
        Reflector,
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AlertRulesController);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Delegation correctness — each endpoint forwards to the service with orgId
  // ---------------------------------------------------------------------------
  it('POST forwards to service.create with orgId', async () => {
    service.create.mockResolvedValue({ id: 'rule-1' } as any);
    const dto: any = { name: 'r', triggerEvent: 'device.offline', scope: 'all', recipients: [] };
    await controller.create(orgId, dto);
    expect(service.create).toHaveBeenCalledWith(orgId, dto);
  });

  it('GET / forwards filters to service.findAll', async () => {
    service.findAll.mockResolvedValue([]);
    const query: any = { isActive: true, triggerEvent: 'device.offline' };
    await controller.findAll(orgId, query);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('GET /:id forwards to service.findOne with orgId', async () => {
    service.findOne.mockResolvedValue({ id: 'rule-1' } as any);
    await controller.findOne(orgId, 'rule-1');
    expect(service.findOne).toHaveBeenCalledWith(orgId, 'rule-1');
  });

  it('PATCH /:id forwards to service.update with orgId', async () => {
    service.update.mockResolvedValue({ id: 'rule-1' } as any);
    const dto: any = { isActive: false };
    await controller.update(orgId, 'rule-1', dto);
    expect(service.update).toHaveBeenCalledWith(orgId, 'rule-1', dto);
  });

  it('DELETE /:id forwards to service.remove with orgId (admin-gated)', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(orgId, 'rule-1');
    expect(service.remove).toHaveBeenCalledWith(orgId, 'rule-1');
  });

  it('POST /:id/recipients forwards to service.addRecipient (admin-gated)', async () => {
    service.addRecipient.mockResolvedValue({ id: 'rec-1' } as any);
    const dto: any = { channel: 'in_app', target: 'user-1' };
    await controller.addRecipient(orgId, 'rule-1', dto);
    expect(service.addRecipient).toHaveBeenCalledWith(orgId, 'rule-1', dto);
  });

  it('DELETE /:id/recipients/:recipientId forwards to service.removeRecipient (admin-gated)', async () => {
    service.removeRecipient.mockResolvedValue(undefined);
    await controller.removeRecipient(orgId, 'rule-1', 'rec-1');
    expect(service.removeRecipient).toHaveBeenCalledWith(orgId, 'rule-1', 'rec-1');
  });

  // ---------------------------------------------------------------------------
  // RBAC metadata check — admin-gated endpoints carry the @Roles('admin') decorator
  // (cannot exercise the guard itself without a full DI ring + JWT context;
  // the structural check below proves the gate is wired)
  // ---------------------------------------------------------------------------
  describe('RBAC decorators', () => {
    const reflector = new Reflector();

    it('PATCH carries @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.update);
      expect(roles).toContain('admin');
    });

    it('DELETE rule carries @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.remove);
      expect(roles).toContain('admin');
    });

    it('POST recipient carries @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.addRecipient);
      expect(roles).toContain('admin');
    });

    it('DELETE recipient carries @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.removeRecipient);
      expect(roles).toContain('admin');
    });

    it('POST create requires @Roles("admin") — PR-review fix', () => {
      // Was previously open to any org user. Tightened because POST allows
      // inline recipients (same privilege as the admin-gated
      // /:id/recipients endpoint — inconsistent to gate one but not the other).
      const roles = reflector.get<string[]>('roles', controller.create);
      expect(roles).toContain('admin');
    });

    it('GET findAll does NOT require admin', () => {
      const roles = reflector.get<string[]>('roles', controller.findAll);
      expect(roles).toBeUndefined();
    });

    it('GET findOne does NOT require admin', () => {
      const roles = reflector.get<string[]>('roles', controller.findOne);
      expect(roles).toBeUndefined();
    });
  });
});
