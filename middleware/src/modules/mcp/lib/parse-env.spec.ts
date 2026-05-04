import { parsePositiveInt } from './parse-env';

describe('parsePositiveInt', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it.each([
    ['60', 60],
    ['1', 1],
    ['1000', 1000],
    [' 30 ', 30],
  ])('parses valid value %s → %d', (input, expected) => {
    expect(parsePositiveInt(input, 99, 'TEST')).toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([undefined, '', null as unknown as undefined])(
    'returns fallback (no warn) when value is %p',
    (input) => {
      expect(parsePositiveInt(input as string | undefined, 99, 'TEST')).toBe(99);
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it.each([
    'sixty',          // textual word — the actual reviewer scenario
    '60abc',          // trailing junk
    'abc60',          // leading junk
    '60.5',           // float
    '0',              // zero is non-positive
    '-1',             // negative
    '-60',            // negative with sign
    '1e3',            // scientific notation
    '0x40',           // hex
    'NaN',            // literal NaN string
    'Infinity',
  ])('falls back + warns when value is %s', (input) => {
    expect(parsePositiveInt(input, 99, 'TEST_VAR')).toBe(99);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TEST_VAR');
    expect(warn.mock.calls[0][0]).toContain(input);
  });

  it('returns the parsed integer (not the fallback) for a normal valid input — sanity', () => {
    expect(parsePositiveInt('42', 99, 'X')).toBe(42);
  });
});
