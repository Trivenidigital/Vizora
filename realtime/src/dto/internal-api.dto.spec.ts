import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BroadcastCommandDto } from './internal-api.dto';

describe('internal API command DTOs', () => {
  it('accepts update commands on the broadcast path', () => {
    const dto = plainToInstance(BroadcastCommandDto, {
      deviceIds: ['display-1'],
      command: {
        type: 'update',
        payload: { feedUrl: 'https://updates.vizora.cloud/display' },
      },
    });

    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
  });
});
