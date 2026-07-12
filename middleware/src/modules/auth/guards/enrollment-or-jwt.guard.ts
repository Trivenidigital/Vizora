import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { MfaService } from '../mfa/mfa.service';

/** Header carrying the forced-enrollment token (NOT the Authorization header,
 * so an enrollment token can never be confused with an access token). */
export const MFA_ENROLLMENT_HEADER = 'x-mfa-enrollment-token';

/**
 * Guard for the MFA enroll/enable endpoints. Accepts EITHER:
 *   - a valid enrollment token (x-mfa-enrollment-token header) — the
 *     forced-enrollment flow, where the user has no session yet; OR
 *   - a normal session JWT (cookie/Bearer) — voluntary enrollment from settings,
 *     validated by the full JwtStrategy (revocation + pwd-change checks).
 *
 * On the enrollment-token path it sets `request.user = { id, mfaEnrollmentOnly:
 * true }` so the handler knows the caller is mid-forced-enrollment and must be
 * handed session tokens once `enable` succeeds.
 */
@Injectable()
export class EnrollmentOrJwtGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly mfaService: MfaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const enrollmentToken = req.headers[MFA_ENROLLMENT_HEADER];
    const raw = Array.isArray(enrollmentToken) ? enrollmentToken[0] : enrollmentToken;

    if (raw && typeof raw === 'string' && raw.length > 0) {
      // Verify the enrollment token (typed + signed with the derived MFA key).
      const { userId } = this.mfaService.verifyEnrollmentToken(raw);
      (req as Request & { user?: unknown }).user = { id: userId, mfaEnrollmentOnly: true };
      return true;
    }

    // No enrollment token — fall back to normal session authentication.
    const result = super.canActivate(context);
    if (typeof result === 'boolean') return result;
    if (result instanceof Promise) return result;
    // Observable → promise
    const { lastValueFrom } = await import('rxjs');
    return lastValueFrom(result);
  }
}
