import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Reflector } from '@nestjs/core';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let mockOrganizationsService: jest.Mocked<OrganizationsService>;

  beforeEach(async () => {
    mockOrganizationsService = {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockOrganizationsService },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createOrganizationDto = {
      name: 'Test Organization',
      slug: 'test-org',
    };

    it('should create an organization (admin only)', async () => {
      const expectedOrg = { id: 'org-123', ...createOrganizationDto };
      mockOrganizationsService.create.mockResolvedValue(expectedOrg as any);

      const result = await controller.create(createOrganizationDto as any);

      expect(result).toEqual(expectedOrg);
      expect(mockOrganizationsService.create).toHaveBeenCalledWith(createOrganizationDto);
    });
  });

  describe('findCurrent', () => {
    it('should return the current user organization', async () => {
      const expectedOrg = { id: 'org-123', name: 'My Organization' };
      mockOrganizationsService.findOne.mockResolvedValue(expectedOrg as any);

      const result = await controller.findCurrent('org-123');

      expect(result).toEqual(expectedOrg);
      expect(mockOrganizationsService.findOne).toHaveBeenCalledWith('org-123');
    });
  });

  describe('findOne', () => {
    it('should return organization when user accesses own org', async () => {
      const userOrgId = 'org-123';
      const expectedOrg = { id: 'org-123', name: 'My Organization' };
      mockOrganizationsService.findOne.mockResolvedValue(expectedOrg as any);

      const result = await controller.findOne(userOrgId, 'org-123');

      expect(result).toEqual(expectedOrg);
      expect(mockOrganizationsService.findOne).toHaveBeenCalledWith('org-123');
    });

    it('should throw ForbiddenException when accessing another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      await expect(controller.findOne(userOrgId, otherOrgId)).rejects.toThrow(ForbiddenException);
      await expect(controller.findOne(userOrgId, otherOrgId)).rejects.toThrow(
        'You can only access your own organization',
      );
    });

    it('should not call service when accessing another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      try {
        await controller.findOne(userOrgId, otherOrgId);
      } catch {
        // Expected
      }

      expect(mockOrganizationsService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Organization Name' };

    it('should update organization when user updates own org', async () => {
      const userOrgId = 'org-123';
      const expectedOrg = { id: 'org-123', ...updateDto };
      mockOrganizationsService.update.mockResolvedValue(expectedOrg as any);

      const result = await controller.update(userOrgId, 'org-123', updateDto as any);

      expect(result).toEqual(expectedOrg);
      expect(mockOrganizationsService.update).toHaveBeenCalledWith('org-123', updateDto);
    });

    it('should throw ForbiddenException when updating another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      await expect(controller.update(userOrgId, otherOrgId, updateDto as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.update(userOrgId, otherOrgId, updateDto as any)).rejects.toThrow(
        'You can only update your own organization',
      );
    });

    it('should not call service when updating another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      try {
        await controller.update(userOrgId, otherOrgId, updateDto as any);
      } catch {
        // Expected
      }

      expect(mockOrganizationsService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove organization when user deletes own org', async () => {
      const userOrgId = 'org-123';
      mockOrganizationsService.remove.mockResolvedValue(undefined);

      await controller.remove(userOrgId, 'org-123');

      expect(mockOrganizationsService.remove).toHaveBeenCalledWith('org-123');
    });

    it('should throw ForbiddenException when deleting another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      await expect(controller.remove(userOrgId, otherOrgId)).rejects.toThrow(ForbiddenException);
      await expect(controller.remove(userOrgId, otherOrgId)).rejects.toThrow(
        'You can only delete your own organization',
      );
    });

    it('should not call service when deleting another org', async () => {
      const userOrgId = 'org-123';
      const otherOrgId = 'org-456';

      try {
        await controller.remove(userOrgId, otherOrgId);
      } catch {
        // Expected
      }

      expect(mockOrganizationsService.remove).not.toHaveBeenCalled();
    });
  });
});
