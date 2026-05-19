import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContentQueryDto } from './content-query.dto';

describe('ContentQueryDto', () => {
  const validateStatus = async (status: string) => {
    const dto = plainToInstance(ContentQueryDto, { status });
    return validate(dto);
  };

  // Whitelist parity with content.service.ts:108 validStatuses.
  // If either side drifts again, this test fails loud — which is exactly
  // the gap the O10 review caught (service accepted pending_approval; DTO
  // rejected it, making the queue unqueryable).
  it.each([
    'active',
    'archived',
    'draft',
    'flagged',
    'rejected',
    'pending_approval',
  ])('accepts status=%s', async (status) => {
    const errors = await validateStatus(status);
    expect(errors).toEqual([]);
  });

  it('rejects unknown status', async () => {
    const errors = await validateStatus('not-a-real-status');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
});
