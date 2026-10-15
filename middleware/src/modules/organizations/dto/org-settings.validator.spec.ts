import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateOrganizationDto } from './update-organization.dto';
import {
  ORG_DEFAULT_DURATION_MAX_SECONDS,
  ORG_DEFAULT_DURATION_MIN_SECONDS,
} from './org-settings.validator';

/**
 * DTO-level validation of `settings.defaultDuration`. `settings` is a free-form
 * blob, so before this nothing stopped the settings page persisting NaN (sent
 * as null), 0 or a negative default.
 */
describe('UpdateOrganizationDto settings.defaultDuration', () => {
  async function settingsErrors(settings: unknown) {
    const dto = plainToInstance(UpdateOrganizationDto, { settings });
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'settings');
  }

  it.each([
    ORG_DEFAULT_DURATION_MIN_SECONDS,
    30,
    ORG_DEFAULT_DURATION_MAX_SECONDS,
  ])('accepts %p', async (defaultDuration) => {
    expect(await settingsErrors({ defaultDuration })).toHaveLength(0);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['above the max', ORG_DEFAULT_DURATION_MAX_SECONDS + 1],
    ['fractional', 1.5],
    ['null (what JSON.stringify makes of NaN)', null],
    ['a numeric string', '30'],
  ])('rejects %s', async (_label, defaultDuration) => {
    const errors = await settingsErrors({ defaultDuration });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(
      /settings\.defaultDuration must be an integer between 1 and 86400 seconds/,
    );
  });

  it('leaves settings without defaultDuration (and its other keys) alone', async () => {
    expect(
      await settingsErrors({ timezone: 'UTC', notifications: { email: true }, branding: {} }),
    ).toHaveLength(0);
    expect(await settingsErrors(undefined)).toHaveLength(0);
  });

  it('reports a non-object settings once, via IsObject', async () => {
    const errors = await settingsErrors('nope');
    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0].constraints ?? {})).toEqual(['isObject']);
  });
});
