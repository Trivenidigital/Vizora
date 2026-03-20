import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { SubscriptionActiveGuard } from '../billing/guards/subscription-active.guard';
import { DatabaseService } from '../database/database.service';

describe('FleetController', () => {
  let controller: FleetController;
  let fleetService: any;

  const mockOrgId = 'org-123';

  beforeEach(async () => {
    const mockFleetService = {
      sendCommand: jest.fn().mockResolvedValue({
        commandId: 'cmd-1',
        command: 'reload',
        target: { type: 'device', id: 'dev-1', name: 'Test' },
        devicesTargeted: 1,
        devicesOnline: 1,
        devicesQueued: 0,
      }),
      getActiveOverrides: jest.fn().mockResolvedValue([]),
      clearOverride: jest.fn().mockResolvedValue({
        commandId: 'cmd-1',
        devicesNotified: 2,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FleetController],
      providers: [
        { provide: FleetService, useValue: mockFleetService },
        { provide: DatabaseService, useValue: {} },
        SubscriptionActiveGuard,
      ],
    }).compile();

    controller = module.get<FleetController>(FleetController);
    fleetService = module.get(FleetService);
  });

  describe('sendCommand', () => {
    it('should pass user and org to service', async () => {
      const user = { id: 'user-1', role: 'admin', organizationId: mockOrgId };
      const dto = {
        command: 'reload' as const,
        target: { type: 'device' as const, id: 'dev-1' },
      };

      await controller.sendCommand(user, mockOrgId, dto);

      expect(fleetService.sendCommand).toHaveBeenCalledWith(
        mockOrgId,
        user.id,
        user.role,
        dto,
      );
    });

    it('should throw ForbiddenException for emergency with non-admin', async () => {
      const user = { id: 'user-1', role: 'manager', organizationId: mockOrgId };
      const dto = {
        command: 'push_content' as const,
        target: { type: 'device' as const, id: 'dev-1' },
        payload: { priority: 'emergency' as const },
      };

      await expect(
        controller.sendCommand(user, mockOrgId, dto),
      ).rejects.toThrow(ForbiddenException);

      expect(fleetService.sendCommand).not.toHaveBeenCalled();
    });

    it('should allow emergency override for admin', async () => {
      const user = { id: 'user-1', role: 'admin', organizationId: mockOrgId };
      const dto = {
        command: 'push_content' as const,
        target: { type: 'device' as const, id: 'dev-1' },
        payload: { priority: 'emergency' as const },
      };

      await controller.sendCommand(user, mockOrgId, dto);

      expect(fleetService.sendCommand).toHaveBeenCalled();
    });
  });

  describe('getActiveOverrides', () => {
    it('should return service result', async () => {
      const overrides = [{ commandId: 'cmd-1' }];
      fleetService.getActiveOverrides.mockResolvedValue(overrides);

      const result = await controller.getActiveOverrides(mockOrgId);

      expect(result).toEqual(overrides);
      expect(fleetService.getActiveOverrides).toHaveBeenCalledWith(mockOrgId);
    });
  });

  describe('clearOverride', () => {
    it('should pass commandId and orgId to service', async () => {
      await controller.clearOverride('cmd-1', mockOrgId);

      expect(fleetService.clearOverride).toHaveBeenCalledWith(
        mockOrgId,
        'cmd-1',
      );
    });
  });
});
