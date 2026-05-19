import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ProvisioningTemplatesController } from './provisioning-templates.controller';
import { ProvisioningTemplatesService } from './provisioning-templates.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ProvisioningTemplatesController', () => {
  let controller: ProvisioningTemplatesController;
  let service: jest.Mocked<ProvisioningTemplatesService>;

  const orgId = 'org-123';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      resolveForPairing: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvisioningTemplatesController],
      providers: [{ provide: ProvisioningTemplatesService, useValue: service }, Reflector],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ProvisioningTemplatesController);
  });

  afterEach(() => jest.clearAllMocks());

  it('POST forwards to service.create with orgId', async () => {
    service.create.mockResolvedValue({ id: 'tpl-1' } as any);
    await controller.create(orgId, { name: 'Lobby TVs' } as any);
    expect(service.create).toHaveBeenCalledWith(orgId, { name: 'Lobby TVs' });
  });

  it('GET / forwards to service.findAll', async () => {
    service.findAll.mockResolvedValue([] as any);
    await controller.findAll(orgId);
    expect(service.findAll).toHaveBeenCalledWith(orgId);
  });

  it('GET /:id forwards to service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 'tpl-1' } as any);
    await controller.findOne(orgId, 'tpl-1');
    expect(service.findOne).toHaveBeenCalledWith(orgId, 'tpl-1');
  });

  it('PATCH /:id forwards to service.update', async () => {
    service.update.mockResolvedValue({ id: 'tpl-1' } as any);
    await controller.update(orgId, 'tpl-1', { name: 'renamed' } as any);
    expect(service.update).toHaveBeenCalledWith(orgId, 'tpl-1', { name: 'renamed' });
  });

  it('DELETE /:id forwards to service.remove', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(orgId, 'tpl-1');
    expect(service.remove).toHaveBeenCalledWith(orgId, 'tpl-1');
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

    it('GET findAll does NOT require admin (any org user)', () => {
      const roles = reflector.get<string[]>('roles', controller.findAll);
      expect(roles).toBeUndefined();
    });

    it('GET findOne does NOT require admin (any org user)', () => {
      const roles = reflector.get<string[]>('roles', controller.findOne);
      expect(roles).toBeUndefined();
    });
  });
});
