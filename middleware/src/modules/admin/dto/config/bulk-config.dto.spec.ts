import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { runMainPipe } from '../../../common/testing/main-validation-pipe';
import { BulkConfigDto } from './bulk-config.dto';

// Through the REAL global pipe: forbidNonWhitelisted only bites at pipe level.
describe('BulkConfigDto through the main ValidationPipe', () => {
  it('accepts string, number, boolean and JSON values and forwards each one unchanged', async () => {
    const configs = [
      { key: 'site.name', value: 'Vizora', dataType: 'string', category: 'general' },
      { key: 'limits.maxScreens', value: 25, dataType: 'number' },
      { key: 'features.beta', value: false, dataType: 'boolean' },
      { key: 'features.flags', value: { a: 1, nested: { b: true } }, dataType: 'json', isSecret: false },
    ];

    const out = await runMainPipe(BulkConfigDto, { configs });

    expect(out.configs.map((c) => [c.key, c.value])).toEqual(configs.map((c) => [c.key, c.value]));
  });

  it.each([
    ['missing', {}],
    ['null', { value: null }],
  ])('rejects an item whose value is %s', async (_label, extra) => {
    await expect(
      runMainPipe(BulkConfigDto, { configs: [{ key: 'site.name', ...extra }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('control: an undecorated value is rejected as a non-whitelisted property', async () => {
    class UndecoratedItem {
      @IsString()
      key!: string;

      value!: unknown;
    }
    class UndecoratedBulk {
      @IsArray()
      @ValidateNested({ each: true })
      @Type(() => UndecoratedItem)
      configs!: UndecoratedItem[];
    }

    const err = await runMainPipe(UndecoratedBulk, { configs: [{ key: 'site.name', value: 'Vizora' }] }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((err as BadRequestException).getResponse())).toContain('property value should not exist');
  });
});
