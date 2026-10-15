import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { runMainPipe } from '../testing/main-validation-pipe';
import { ListAlertRulesQueryDto } from '../../notifications/alert-rules/dto/list-alert-rules-query.dto';
import { ListTagRulesQueryDto } from '../../tag-rules/dto/list-tag-rules-query.dto';
import { UserFiltersDto } from '../../admin/dto/users/user-filters.dto';
import { OrgFiltersDto } from '../../admin/dto/organizations/org-filters.dto';

/**
 * Boolean query filters through the REAL global pipe (main.ts options). The
 * pipe applies implicit conversion before @Transform, so `?isActive=false`
 * used to reach the transform as `true` — every "show inactive" filter
 * returned the active set. plainToInstance-only tests cannot see the ordering
 * difference that matters here; this suite runs the pipe itself.
 */
const cases: Array<[string, new () => object, string]> = [
  ['ListAlertRulesQueryDto', ListAlertRulesQueryDto, 'isActive'],
  ['ListTagRulesQueryDto', ListTagRulesQueryDto, 'isActive'],
  ['UserFiltersDto', UserFiltersDto, 'isActive'],
  ['UserFiltersDto', UserFiltersDto, 'isSuperAdmin'],
  ['OrgFiltersDto', OrgFiltersDto, 'hasOverduePayment'],
];

describe.each(cases)('%s.%s through the main ValidationPipe', (_name, Dto, field) => {
  const query = (value: unknown) => runMainPipe(Dto, { [field]: value }, 'query') as Promise<Record<string, unknown>>;

  it("'false' → false", async () => {
    await expect(query('false')).resolves.toMatchObject({ [field]: false });
  });

  it("'true' → true", async () => {
    await expect(query('true')).resolves.toMatchObject({ [field]: true });
  });

  it('absent → undefined (no filter)', async () => {
    const out = (await runMainPipe(Dto, {}, 'query')) as Record<string, unknown>;
    expect(out[field]).toBeUndefined();
  });

  // Explicitly a 400, not a guess: an ambiguous filter must not silently pick a side.
  it.each(['', '1', '0', 'yes', 'FALSE', ['true', 'false']])('rejects %j with 400', async (value) => {
    await expect(query(value)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('control: the transforms this replaced invert ?x=false through the same pipe', () => {
  class OldValueTransformDto {
    @IsOptional()
    @Transform(({ value }) => {
      if (value === 'true' || value === true) return true;
      if (value === 'false' || value === false) return false;
      return value;
    })
    @IsBoolean()
    isActive?: boolean;
  }

  class OldTypeBooleanDto {
    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    isActive?: boolean;
  }

  it.each([
    ['@Transform(({ value }) => ...)', OldValueTransformDto],
    ['@Type(() => Boolean)', OldTypeBooleanDto],
  ])("%s turns 'false' into true", async (_label, Dto) => {
    await expect(runMainPipe(Dto as new () => object, { isActive: 'false' }, 'query')).resolves.toMatchObject({
      isActive: true,
    });
  });
});
