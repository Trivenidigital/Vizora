import { registerSchema, resetPasswordSchema } from '../validation';

/**
 * The client's register rules must be the SERVER's register rules.
 *
 * `middleware/src/modules/auth/dto/register.dto.ts` is the contract. Three client
 * layers had drifted from it — the per-field ticks, this schema, and the password
 * checklist — which is how "Sri / Y / ABC" could show three green ticks and then
 * come back as a bare 400. Each case below names the DTO rule it mirrors, so a
 * future server change has an obvious place to land.
 *
 * Deliberately NOT a mirror of the implementation: every expectation is written
 * from the DTO, not from what the schema currently does.
 */
const valid = {
  email: 'sri@example.com',
  password: 'Abcdefg1',
  confirmPassword: 'Abcdefg1',
  firstName: 'Sri',
  lastName: 'Yalavarthi',
  organizationName: 'ABC Ltd',
};

const parse = (over: Partial<typeof valid>) => registerSchema.safeParse({ ...valid, ...over });

describe('register contract: names mirror @MinLength(2) @MaxLength(100)', () => {
  it('REJECTS a one-character last name, which the server rejects', () => {
    // The reported bug, exactly: lastName "Y" passed the client and failed the DTO.
    expect(parse({ lastName: 'Y' }).success).toBe(false);
  });

  it('REJECTS a one-character first name', () => {
    expect(parse({ firstName: 'S' }).success).toBe(false);
  });

  it('REJECTS a one-character organization name', () => {
    // organizationName is @MinLength(2) too.
    expect(parse({ organizationName: 'A' }).success).toBe(false);
  });

  it('ACCEPTS a 60-character surname, because the server allows 100', () => {
    // The mirror image of the bug: the client was capping at 50, so a long but
    // perfectly valid name was blocked client-side for no reason.
    expect(parse({ lastName: 'y'.repeat(60) }).success).toBe(true);
  });

  it('ACCEPTS a 200-character organization name, because the server allows 255', () => {
    expect(parse({ organizationName: 'a'.repeat(200) }).success).toBe(true);
  });

  it('REJECTS past the server ceilings', () => {
    expect(parse({ lastName: 'y'.repeat(101) }).success).toBe(false);
    expect(parse({ organizationName: 'a'.repeat(256) }).success).toBe(false);
  });
});

describe('register contract: password mirrors @StrongPassword()', () => {
  it('ACCEPTS upper + lower + SPECIAL with no digit, which the server accepts', () => {
    // The DTO wants a digit OR a special character. The client demanded a digit,
    // so this password satisfied every row of the visible checklist and was then
    // rejected at submit for a rule the checklist does not state.
    expect(parse({ password: 'Abcdefg!', confirmPassword: 'Abcdefg!' }).success).toBe(true);
  });

  it('REJECTS a password with no lowercase, which the server rejects', () => {
    expect(parse({ password: 'ABCDEFG1', confirmPassword: 'ABCDEFG1' }).success).toBe(false);
  });

  it('REJECTS a password with no uppercase', () => {
    expect(parse({ password: 'abcdefg1', confirmPassword: 'abcdefg1' }).success).toBe(false);
  });

  it('REJECTS a password with neither a digit nor a special character', () => {
    expect(parse({ password: 'Abcdefgh', confirmPassword: 'Abcdefgh' }).success).toBe(false);
  });

  it('REJECTS under 8 characters', () => {
    expect(parse({ password: 'Abcdef1', confirmPassword: 'Abcdef1' }).success).toBe(false);
  });

  it('REJECTS over 72 BYTES, which is bcrypt silent truncation', () => {
    // The DTO caps BYTES, not characters, because bcrypt truncates at 72 bytes
    // and two passwords sharing a 72-byte prefix authenticate interchangeably.
    const long = 'Aa1' + 'x'.repeat(70); // 73 ASCII bytes
    expect(long.length).toBeGreaterThan(72);
    expect(parse({ password: long, confirmPassword: long }).success).toBe(false);
  });

  it('counts BYTES not characters, so multibyte input cannot slip past', () => {
    const multibyte = 'Aa1' + 'é'.repeat(35); // 3 + 70 = 73 bytes, 38 chars
    // Independent of the implementation: é is 2 UTF-8 bytes, so this is 73 bytes
    // in 38 UTF-16 code units — under any character cap, over the byte cap.
    expect(multibyte.length).toBe(38);
    expect(3 + 35 * 2).toBeGreaterThan(72);
    expect(parse({ password: multibyte, confirmPassword: multibyte }).success).toBe(false);
  });

  it('still requires the two password entries to match', () => {
    expect(parse({ confirmPassword: 'Different1' }).success).toBe(false);
  });
});

describe('register contract: email mirrors the DTO transform', () => {
  it('ACCEPTS an address with surrounding whitespace, which the server trims', () => {
    // @Transform lowercases and trims BEFORE @IsEmail runs, so rejecting this
    // client-side would be stricter than the server.
    expect(parse({ email: '  Sri@Example.COM  ' }).success).toBe(true);
  });

  it('REJECTS something that is not an address', () => {
    expect(parse({ email: 'sri@' }).success).toBe(false);
    expect(parse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('reset-password shares the same @StrongPassword() mirror', () => {
  /*
   * The same defect lived in a second form. Both render the same
   * PasswordChecklist, which states the server rule correctly, so a user could
   * tick every visible row and still be refused at submit.
   */
  const reset = (newPassword: string) =>
    resetPasswordSchema.safeParse({ newPassword, confirmPassword: newPassword });

  it('ACCEPTS upper + lower + special with no digit, as the DTO does', () => {
    expect(reset('Abcdefg!').success).toBe(true);
  });

  it('REJECTS a password with no lowercase, as the DTO does', () => {
    expect(reset('ABCDEFG1').success).toBe(false);
  });

  it('REJECTS over 72 bytes, which the old rule did not check at all', () => {
    expect(reset('Aa1' + 'x'.repeat(70)).success).toBe(false);
  });
});
