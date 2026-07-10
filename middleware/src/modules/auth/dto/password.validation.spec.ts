import { validate } from 'class-validator';
import { StrongPassword, PASSWORD_MAX_BYTES } from './password.validation';

class PwHolder {
  @StrongPassword()
  password!: string;
}

async function constraintsFor(pw: string): Promise<Record<string, string> | undefined> {
  const holder = new PwHolder();
  holder.password = pw;
  const errors = await validate(holder);
  return errors.length ? errors[0].constraints : undefined;
}

describe('StrongPassword', () => {
  it('accepts a strong password', async () => {
    expect(await constraintsFor('SecurePass123!')).toBeUndefined();
  });

  it('rejects a password with no lowercase (the old reset-password gap)', async () => {
    const c = await constraintsFor('PASSWORD123!');
    expect(c).toBeDefined();
    expect(Object.keys(c!)).toContain('matches');
  });

  it('rejects a password shorter than 8 characters', async () => {
    expect(await constraintsFor('Ab1!')).toBeDefined();
  });

  it('rejects a password longer than 72 bytes (bcrypt truncation cap)', async () => {
    const pw = 'Aa1!' + 'a'.repeat(70); // 74 bytes
    expect(Buffer.byteLength(pw, 'utf8')).toBeGreaterThan(PASSWORD_MAX_BYTES);
    const c = await constraintsFor(pw);
    expect(c).toBeDefined();
    expect(Object.keys(c!)).toContain('maxBytes');
  });

  it('counts BYTES not characters — a multibyte password over 72 bytes is rejected', async () => {
    // 'Aa1!' (4 bytes) + 24 × '你' (3 bytes each = 72) = 76 bytes, but only 28 chars.
    const pw = 'Aa1!' + '你'.repeat(24);
    expect(pw.length).toBeLessThanOrEqual(PASSWORD_MAX_BYTES); // char count is under the cap...
    expect(Buffer.byteLength(pw, 'utf8')).toBeGreaterThan(PASSWORD_MAX_BYTES); // ...byte count is not
    const c = await constraintsFor(pw);
    expect(c).toBeDefined();
    expect(Object.keys(c!)).toContain('maxBytes');
  });
});
