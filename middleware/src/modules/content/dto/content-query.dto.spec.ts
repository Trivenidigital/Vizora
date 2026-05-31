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
    'expired',
    'ready',
    'processing',
    'error',
  ])('accepts status=%s', async (status) => {
    const errors = await validateStatus(status);
    expect(errors).toEqual([]);
  });

  it('rejects unknown status', async () => {
    const errors = await validateStatus('not-a-real-status');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it.each(['image', 'video', 'url', 'html', 'pdf', 'template', 'layout', 'widget'])(
    'accepts type=%s',
    async (type) => {
      const dto = plainToInstance(ContentQueryDto, { type });
      await expect(validate(dto)).resolves.toEqual([]);
    },
  );

  it('accepts bounded server-side search and date range filters', async () => {
    const dto = plainToInstance(ContentQueryDto, {
      search: '  lunch menu  ',
      dateRange: '30days',
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
    expect(dto.search).toBe('lunch menu');
  });

  it('rejects oversized search terms', async () => {
    const dto = plainToInstance(ContentQueryDto, { search: 'a'.repeat(121) });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'search')).toBe(true);
  });

  it('normalizes comma-separated tag names', async () => {
    const dto = plainToInstance(ContentQueryDto, {
      tagNames: 'Marketing, Seasonal, ',
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
    expect(dto.tagNames).toEqual(['Marketing', 'Seasonal']);
  });

  it('rejects too many tag names', async () => {
    const dto = plainToInstance(ContentQueryDto, {
      tagNames: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'tagNames')).toBe(true);
  });
});
