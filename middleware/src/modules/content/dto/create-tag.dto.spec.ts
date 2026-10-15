import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import { CreateTagDto, CONTENT_TAG_COLORS } from './create-tag.dto';

const toDto = (plain: Record<string, unknown>) => plainToInstance(CreateTagDto, plain);

describe('CreateTagDto', () => {
  it('accepts a name and a palette colour', async () => {
    await expect(validate(toDto({ name: 'Holiday', color: 'red' }))).resolves.toHaveLength(0);
  });

  it('accepts an omitted colour', async () => {
    await expect(validate(toDto({ name: 'Holiday' }))).resolves.toHaveLength(0);
  });

  it('trims the name before validating it', async () => {
    const dto = toDto({ name: '  Promo  ' });

    expect(dto.name).toBe('Promo');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a whitespace-only name', async () => {
    const errors = await validate(toDto({ name: '   ' }));
    expect(errors.map((e) => e.property)).toEqual(['name']);
  });

  it('rejects a missing name', async () => {
    const errors = await validate(toDto({}));
    expect(errors.map((e) => e.property)).toEqual(['name']);
  });

  it('rejects a name longer than 50 characters', async () => {
    await expect(validate(toDto({ name: 'a'.repeat(50) }))).resolves.toHaveLength(0);
    const errors = await validate(toDto({ name: 'a'.repeat(51) }));
    expect(errors.map((e) => e.property)).toEqual(['name']);
  });

  it('rejects a colour outside the persisted palette', async () => {
    for (const color of ['orange', '#ff0000', 'Blue', '']) {
      const errors = await validate(toDto({ name: 'X', color }));
      expect(errors.map((e) => e.property)).toEqual(['color']);
    }
  });

  // The palette is persisted by NAME and rendered by the web ContentTagger, so
  // the two lists must not drift: a name the server accepts but the component
  // does not know renders as the fallback colour.
  it('matches the colour names the web ContentTagger renders', () => {
    const taggerPath = path.resolve(
      __dirname,
      '../../../../../web/src/components/ContentTagger.tsx',
    );
    const source = fs.readFileSync(taggerPath, 'utf8');
    const block = source.slice(source.indexOf('const TAG_COLORS'), source.indexOf('];', source.indexOf('const TAG_COLORS')));
    const webNames = [...block.matchAll(/name: '([a-z]+)'/g)].map((m) => m[1]);

    expect(webNames.length).toBeGreaterThan(0);
    expect(webNames).toEqual([...CONTENT_TAG_COLORS]);
  });
});
