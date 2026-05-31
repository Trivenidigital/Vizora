import { getEntityId } from './ids';

describe('getEntityId', () => {
  it('prefers API id over legacy _id', () => {
    expect(getEntityId({ id: 'api-id', _id: 'legacy-id' })).toBe('api-id');
  });

  it('falls back to legacy _id', () => {
    expect(getEntityId({ _id: 'legacy-id' })).toBe('legacy-id');
  });

  it('returns undefined for missing or blank ids', () => {
    expect(getEntityId({ id: '', _id: '   ' })).toBeUndefined();
    expect(getEntityId(null)).toBeUndefined();
  });
});
