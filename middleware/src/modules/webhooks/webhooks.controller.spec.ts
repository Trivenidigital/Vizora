import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<WebhooksService>;
  const orgId = 'org-123';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findDeliveries: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: service }, Reflector],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(WebhooksController);
  });

  afterEach(() => jest.clearAllMocks());

  it('POST forwards to service.create', async () => {
    service.create.mockResolvedValue({ id: 'hook-1' } as any);
    await controller.create(orgId, { name: 'h' } as any);
    expect(service.create).toHaveBeenCalledWith(orgId, { name: 'h' });
  });

  it('GET / forwards to service.findAll', async () => {
    service.findAll.mockResolvedValue([] as any);
    await controller.findAll(orgId);
    expect(service.findAll).toHaveBeenCalledWith(orgId);
  });

  it('GET /:id forwards to service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 'hook-1' } as any);
    await controller.findOne(orgId, 'hook-1');
    expect(service.findOne).toHaveBeenCalledWith(orgId, 'hook-1');
  });

  it('PATCH /:id forwards to service.update', async () => {
    service.update.mockResolvedValue({ id: 'hook-1' } as any);
    await controller.update(orgId, 'hook-1', { name: 'renamed' } as any);
    expect(service.update).toHaveBeenCalledWith(orgId, 'hook-1', { name: 'renamed' });
  });

  it('DELETE /:id forwards to service.remove', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(orgId, 'hook-1');
    expect(service.remove).toHaveBeenCalledWith(orgId, 'hook-1');
  });

  it('GET /:id/deliveries forwards to service.findDeliveries with query', async () => {
    service.findDeliveries.mockResolvedValue({ data: [], meta: {} } as any);
    await controller.findDeliveries(orgId, 'hook-1', { status: 'blocked', page: 2, limit: 25 });
    expect(service.findDeliveries).toHaveBeenCalledWith(orgId, 'hook-1', {
      status: 'blocked',
      page: 2,
      limit: 25,
    });
  });

  describe('RBAC decorators', () => {
    const reflector = new Reflector();

    it('POST create requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.create);
      expect(roles).toContain('admin');
    });

    it('PATCH requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.update);
      expect(roles).toContain('admin');
    });

    it('DELETE requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.remove);
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

    it('GET findDeliveries requires admin OR manager (NOT viewer)', () => {
      const roles = reflector.get<string[]>('roles', controller.findDeliveries);
      expect(roles).toEqual(expect.arrayContaining(['admin', 'manager']));
      expect(roles).not.toContain('viewer');
    });
  });
});
