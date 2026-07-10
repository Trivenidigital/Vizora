import { plainToInstance } from 'class-transformer';
import { ForgotPasswordDto } from './forgot-password.dto';
import { InviteUserDto } from '../../users/dto/invite-user.dto';

/**
 * Regression for auth #5: login/register already normalized email, but
 * forgot-password and invite did not — so a mixed-case forgot-password silently
 * sent nothing (and rotated case bypassed the 3/hr cap), and a mixed-case invite
 * created an account that later (lowercased) logins could never match.
 */
describe('email normalization (@Transform)', () => {
  it('ForgotPasswordDto lowercases and trims the email', () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: '  John@Example.COM ' });
    expect(dto.email).toBe('john@example.com');
  });

  it('InviteUserDto lowercases and trims the email', () => {
    const dto = plainToInstance(InviteUserDto, {
      email: '  Jane@Example.COM ',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'viewer',
    });
    expect(dto.email).toBe('jane@example.com');
  });

  it('leaves a non-string email untouched (validation reports the type error)', () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 123 as unknown as string });
    expect(dto.email).toBe(123);
  });
});
