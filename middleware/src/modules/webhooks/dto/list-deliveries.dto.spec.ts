import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDeliveriesDto } from './list-deliveries.dto';
import { WEBHOOK_DELIVERY_STATUSES } from '../webhook.types';

describe('ListDeliveriesDto', () => {
  const buildAndValidate = async (input: Record<string, unknown>) => {
    const dto = plainToInstance(ListDeliveriesDto, input);
    return validate(dto);
  };

  it.each([...WEBHOOK_DELIVERY_STATUSES])('accepts status=%s', async (status) => {
    const errors = await buildAndValidate({ status });
    expect(errors).toEqual([]);
  });

  it('rejects unknown status', async () => {
    const errors = await buildAndValidate({ status: 'definitely-not-a-status' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('omits status (optional)', async () => {
    const errors = await buildAndValidate({});
    expect(errors).toEqual([]);
  });

  it('enforces PaginationDto cap: limit > 100 rejected', async () => {
    const errors = await buildAndValidate({ limit: 500 });
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError!.constraints).toHaveProperty('max');
  });

  it('limit=100 is accepted (boundary)', async () => {
    const errors = await buildAndValidate({ limit: 100 });
    expect(errors).toEqual([]);
  });

  it('page < 1 rejected', async () => {
    const errors = await buildAndValidate({ page: 0 });
    const pageError = errors.find((e) => e.property === 'page');
    expect(pageError).toBeDefined();
  });
});
