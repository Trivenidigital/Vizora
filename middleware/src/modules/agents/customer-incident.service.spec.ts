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
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    db = {
      customerIncident: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
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

  it('create passes organizationId (from caller, not DTO) through to the DB write (D8)', async () => {
    db.customerIncident.create.mockResolvedValue({ id: 'i1' });
    await service.create('o1', {
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

  it('listOpenForOrg filters by organizationId + status=open and paginates', async () => {
    db.customerIncident.findMany.mockResolvedValue([]);
    db.customerIncident.count.mockResolvedValue(0);
    const result = await service.listOpenForOrg('o1');
    expect(db.customerIncident.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'o1', status: 'open' },
      orderBy: { detectedAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(db.customerIncident.count).toHaveBeenCalledWith({
      where: { organizationId: 'o1', status: 'open' },
    });
    expect(result).toEqual({ incidents: [], page: 1, limit: 10, total: 0 });
  });

  it('listOpenForOrg clamps limit to [1, 100] and page to ≥1', async () => {
    db.customerIncident.findMany.mockResolvedValue([]);
    db.customerIncident.count.mockResolvedValue(0);
    await service.listOpenForOrg('o1', 0, 999);
    expect(db.customerIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
    await service.listOpenForOrg('o1', 3, 5);
    expect(db.customerIncident.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });
});
