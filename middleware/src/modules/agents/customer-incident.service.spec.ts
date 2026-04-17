import { Test } from '@nestjs/testing';
import { CustomerIncidentService } from './customer-incident.service';
import { DatabaseService } from '../database/database.service';

describe('CustomerIncidentService', () => {
  let service: CustomerIncidentService;
  let db: {
    customerIncident: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    db = {
      customerIncident: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        CustomerIncidentService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = mod.get(CustomerIncidentService);
  });

  it('create passes organizationId through to the DB write (D8)', async () => {
    db.customerIncident.create.mockResolvedValue({ id: 'i1' });
    await service.create({
      organizationId: 'o1',
      agent: 'customer-lifecycle',
      type: 'stall',
      severity: 'warning',
      target: 'onboarding',
      targetId: 'o1',
      message: 'm',
      remediation: 'r',
    });
    expect(db.customerIncident.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'o1' }),
    });
  });

  it('resolve scopes the update by both id AND organizationId', async () => {
    db.customerIncident.updateMany.mockResolvedValue({ count: 1 });
    await service.resolve('o1', 'i1');
    expect(db.customerIncident.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', organizationId: 'o1' },
      data: { status: 'resolved', resolvedAt: expect.any(Date) },
    });
  });

  it('listOpenForOrg filters by organizationId + status=open', async () => {
    db.customerIncident.findMany.mockResolvedValue([]);
    await service.listOpenForOrg('o1');
    expect(db.customerIncident.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'o1', status: 'open' },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
  });
});
