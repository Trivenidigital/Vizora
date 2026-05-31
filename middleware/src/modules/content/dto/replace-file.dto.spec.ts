import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReplaceFileDto } from './replace-file.dto';

describe('ReplaceFileDto', () => {
  it('parses multipart string false as boolean false', async () => {
    const dto = plainToInstance(
      ReplaceFileDto,
      { keepBackup: 'false' },
      { enableImplicitConversion: true },
    );

    expect(dto.keepBackup).toBe(false);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('parses multipart string true as boolean true', async () => {
    const dto = plainToInstance(
      ReplaceFileDto,
      { keepBackup: 'true' },
      { enableImplicitConversion: true },
    );

    expect(dto.keepBackup).toBe(true);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-boolean keepBackup values', async () => {
    const dto = plainToInstance(
      ReplaceFileDto,
      { keepBackup: 'maybe' },
      { enableImplicitConversion: true },
    );

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('keepBackup');
  });
});
