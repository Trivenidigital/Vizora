import { BadRequestException } from '@nestjs/common';
import { runMainPipe } from '../../common/testing/main-validation-pipe';
import { CreatePlaylistDto } from './create-playlist.dto';
import { UpdatePlaylistDto } from './update-playlist.dto';

// Through the REAL global pipe: nested items are only validated once
// @ValidateNested/@Type are honoured, which is what made these bounds matter.
describe.each([
  ['CreatePlaylistDto', CreatePlaylistDto],
  ['UpdatePlaylistDto', UpdatePlaylistDto],
] as const)('%s.items[] through the main ValidationPipe', (_name, Dto) => {
  const withItem = (item: Record<string, unknown>) =>
    runMainPipe(Dto as new () => CreatePlaylistDto, { name: 'Lobby', items: [{ contentId: 'c-1', ...item }] });

  it('accepts integer order/duration, including numeric strings, as numbers', async () => {
    const out = await withItem({ order: '0', duration: '30' });
    expect(out.items![0]).toMatchObject({ contentId: 'c-1', order: 0, duration: 30 });
  });

  it('accepts an item with neither field (the service defaults both)', async () => {
    const out = await withItem({});
    expect(out.items![0].order).toBeUndefined();
    expect(out.items![0].duration).toBeUndefined();
  });

  it.each([
    ['order', 'abc'],
    ['order', 1.5],
    ['order', -1],
    ['duration', 'abc'],
    ['duration', 2.5],
    ['duration', 0],
    ['duration', 86401],
  ])('rejects %s=%j with 400 (used to be stored as NaN / out of range)', async (field, value) => {
    await expect(withItem({ [field]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the bounds: order 0, duration 1 and 86400', async () => {
    await expect(withItem({ order: 0, duration: 1 })).resolves.toBeDefined();
    await expect(withItem({ duration: 86400 })).resolves.toBeDefined();
  });
});
