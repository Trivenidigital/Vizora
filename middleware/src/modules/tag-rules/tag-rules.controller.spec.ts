import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TagRulesController } from './tag-rules.controller';
import { TagRulesService } from './tag-rules.service';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('TagRulesController', () => {
  let controller: TagRulesController;
  let service: jest.Mocked<TagRulesService>;

  const orgId = 'org-123';

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      reEvaluateRule: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagRulesController],
      providers: [{ provide: TagRulesService, useValue: service }, Reflector],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TagRulesController);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Delegation correctness — each endpoint forwards orgId
  // ---------------------------------------------------------------------------
  it('POST / forwards to service.create with orgId', async () => {
    service.create.mockResolvedValue({ id: 'rule-1' } as any);
    const dto: any = { name: 'r', tagId: 'tag-1', playlistId: 'pl-1' };
    await controller.create(orgId, dto);
    expect(service.create).toHaveBeenCalledWith(orgId, dto);
  });

  it('GET / forwards filters to service.findAll', async () => {
    service.findAll.mockResolvedValue([]);
    const query: any = { isActive: true };
    await controller.findAll(orgId, query);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('GET /:id forwards to service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 'rule-1' } as any);
    await controller.findOne(orgId, 'rule-1');
    expect(service.findOne).toHaveBeenCalledWith(orgId, 'rule-1');
  });

  it('PATCH /:id forwards to service.update (admin-gated)', async () => {
    service.update.mockResolvedValue({ id: 'rule-1' } as any);
    const dto: any = { priority: 50 };
    await controller.update(orgId, 'rule-1', dto);
    expect(service.update).toHaveBeenCalledWith(orgId, 'rule-1', dto);
  });

  it('DELETE /:id forwards to service.remove (admin-gated)', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(orgId, 'rule-1');
    expect(service.remove).toHaveBeenCalledWith(orgId, 'rule-1');
  });

  it('POST /:id/re-evaluate forwards to service.reEvaluateRule (admin-gated)', async () => {
    service.reEvaluateRule.mockResolvedValue({ scanned: 5, assigned: 3 });
    await controller.reEvaluate(orgId, 'rule-1');
    expect(service.reEvaluateRule).toHaveBeenCalledWith(orgId, 'rule-1');
  });

  // ---------------------------------------------------------------------------
  // RBAC metadata check
  // ---------------------------------------------------------------------------
  describe('RBAC decorators', () => {
    const reflector = new Reflector();

    it('POST create requires @Roles("admin") (mutation = admin-gated, matches O7)', () => {
      const roles = reflector.get<string[]>('roles', controller.create);
      expect(roles).toContain('admin');
    });

    it('PATCH update requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.update);
      expect(roles).toContain('admin');
    });

    it('DELETE remove requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.remove);
      expect(roles).toContain('admin');
    });

    it('POST re-evaluate requires @Roles("admin")', () => {
      const roles = reflector.get<string[]>('roles', controller.reEvaluate);
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
