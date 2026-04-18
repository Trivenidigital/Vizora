import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import type { AgentStateService } from './agent-state.service';
import type { CustomerIncidentService } from './customer-incident.service';
import type { CreateCustomerIncidentDto } from './dto/create-customer-incident.dto';

/**
 * Controller-level tests (R4-HIGH8). Guard + pipe behavior is covered in the
 * e2e suite — here we lock the handler logic itself: allowlisted agent names,
 * org-context derivation from @CurrentUser (never body), and the 404/201
 * status contract.
 */
describe('AgentsController', () => {
  let controller: AgentsController;
  let state: jest.Mocked<
    Pick<AgentStateService, 'aggregateStatus' | 'read' | 'enqueueManualRun'>
  >;
  let incidents: jest.Mocked<
    Pick<
      CustomerIncidentService,
      'create' | 'listOpenForOrg' | 'resolve'
    >
  >;

  const dto: CreateCustomerIncidentDto = {
    agent: 'customer-lifecycle',
    type: 'nudge_send_failed',
    severity: 'warning',
    target: 'organization',
    targetId: 'org-1',
    message: 'smtp unreachable',
  };

  beforeEach(() => {
    state = {
      aggregateStatus: jest.fn(),
      read: jest.fn(),
      enqueueManualRun: jest.fn(),
    };
    incidents = {
      create: jest.fn(),
      listOpenForOrg: jest.fn(),
      resolve: jest.fn(),
    };
    controller = new AgentsController(
      state as unknown as AgentStateService,
      incidents as unknown as CustomerIncidentService,
    );
  });

  describe('agent-name allowlist', () => {
    it('state(name) rejects unknown agents with BadRequest', async () => {
      await expect(controller.agentState('not-an-agent')).rejects.toThrow(
        BadRequestException,
      );
      expect(state.read).not.toHaveBeenCalled();
    });

    it('trigger(name) rejects unknown agents with BadRequest', async () => {
      await expect(controller.trigger('not-an-agent')).rejects.toThrow(
        BadRequestException,
      );
      expect(state.enqueueManualRun).not.toHaveBeenCalled();
    });

    it('trigger(name) accepts a known agent and delegates to state service', async () => {
      state.enqueueManualRun.mockResolvedValue({ queued: true } as any);
      await controller.trigger('customer-lifecycle');
      expect(state.enqueueManualRun).toHaveBeenCalledWith('customer-lifecycle');
    });
  });

  describe('incident endpoints — org scoping from @CurrentUser', () => {
    it('createIncident rejects when organizationId is absent (JWT wiring bug)', async () => {
      await expect(controller.createIncident('', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(incidents.create).not.toHaveBeenCalled();
    });

    it('createIncident forwards the caller orgId — NOT any id in the DTO', async () => {
      incidents.create.mockResolvedValue({ id: 'i1' } as any);
      // Even if a malicious client slipped organizationId into the body, the
      // controller must pass the JWT-derived value through untouched.
      const attackDto = { ...dto, organizationId: 'other-org' } as any;
      await controller.createIncident('caller-org', attackDto);
      expect(incidents.create).toHaveBeenCalledWith('caller-org', attackDto);
    });

    it('listIncidents rejects when organizationId is absent', async () => {
      await expect(controller.listIncidents('')).rejects.toThrow(
        BadRequestException,
      );
      expect(incidents.listOpenForOrg).not.toHaveBeenCalled();
    });

    it('listIncidents forwards the caller orgId to the service', async () => {
      incidents.listOpenForOrg.mockResolvedValue([]);
      await controller.listIncidents('caller-org');
      expect(incidents.listOpenForOrg).toHaveBeenCalledWith('caller-org');
    });

    it('resolveIncident rejects when organizationId is absent', async () => {
      await expect(controller.resolveIncident('', 'i1')).rejects.toThrow(
        BadRequestException,
      );
      expect(incidents.resolve).not.toHaveBeenCalled();
    });

    it('resolveIncident returns 404 when the id does not match the caller org', async () => {
      // updateMany returning {count:0} = either id is wrong OR the id belongs
      // to another org. Controller must NOT leak which; 404 for both.
      incidents.resolve.mockResolvedValue({ count: 0 } as any);
      await expect(
        controller.resolveIncident('caller-org', 'other-orgs-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolveIncident returns the resolved id on success', async () => {
      incidents.resolve.mockResolvedValue({ count: 1 } as any);
      const out = await controller.resolveIncident('caller-org', 'i1');
      expect(out).toEqual({ id: 'i1', status: 'resolved' });
      expect(incidents.resolve).toHaveBeenCalledWith('caller-org', 'i1');
    });
  });
});
