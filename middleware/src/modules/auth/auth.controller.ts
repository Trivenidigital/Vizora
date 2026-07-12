import { Controller, Post, Patch, Body, UseGuards, Get, Delete, Param, Res, Req, HttpCode, HttpStatus, BadRequestException, NotFoundException, UnauthorizedException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenService, RefreshTokenContext } from './refresh-token.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, DeleteAccountDto, UpdateProfileDto, GoogleLoginDto } from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { AuthenticatedUser } from './strategies/jwt.strategy';

/**
 * Auth endpoint rate-limit tiers. STRICT in production (per-minute caps
 * chosen to block credential-stuffing / token-enumeration), RELAXED in
 * dev/test so local development + CI don't trip throttles.
 *
 * Extracted as named constants so new public auth routes can't silently
 * inherit a 1000-limit by copy-paste of the dev pattern. If you're
 * adding a new public auth route, pick STRICT for sensitive operations
 * (register, credentials, account modification) and STANDARD for
 * lookup/validation operations.
 */
const RATE_LIMIT_STRICT = process.env.NODE_ENV === 'production' ? 3 : 1000;
const RATE_LIMIT_STANDARD = process.env.NODE_ENV === 'production' ? 5 : 1000;
// Refresh runs more often than login (the frontend re-ups the session), so it
// gets a slightly higher cap than STANDARD while still throttling refresh-token
// abuse / enumeration attempts.
const RATE_LIMIT_REFRESH = process.env.NODE_ENV === 'production' ? 10 : 1000;
const RATE_LIMIT_TTL_MS = 60_000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Stable, browser-reachable avatar URL. Relative so it flows through the
   * Next.js `/api/v1` rewrite proxy (same-origin cookies) and is served by the
   * authenticated middleware proxy (GET /auth/me/avatar) — not a presigned
   * MinIO URL, which is unreachable from the browser in prod (PR-7b).
   */
  private static readonly AVATAR_URL_PATH = '/api/v1/auth/me/avatar';

  /**
   * Set auth token as httpOnly cookie.
   *
   * No explicit domain set — cookies are scoped to the exact origin host.
   * This works because the Next.js frontend proxies all API calls through
   * its own origin, making cross-port cookie sharing unnecessary.
   */
  private setAuthCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      maxAge: number;
      path: string;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      // DECOUPLED from the JWT lifetime (PR-17b). The cookie maxAge is a long
      // "you have a session" PRESENCE marker (matched to the refresh-token TTL,
      // ~30d) — NOT a security boundary. The real boundary is the JWT's own
      // `exp` (short, 30m by default), which JwtStrategy validates server-side
      // on EVERY request: a leaked/stolen cookie's JWT is still only good for
      // 30m. Keeping the cookie long-lived stops `web/src/middleware.ts` (which
      // gates page navigations on cookie PRESENCE, not JWT expiry) from bouncing
      // an idle user to /login after 30m; when the JWT inside expires, the next
      // API call 401s and the frontend auto-refresh mints a fresh JWT + cookie.
      maxAge: this.refreshTokenService.getTtlSeconds() * 1000,
      path: '/',
    };

    res.cookie(AUTH_CONSTANTS.COOKIE_NAME, token, cookieOptions);
  }

  /**
   * Clear auth cookie on logout.
   * Must use same options as setAuthCookie for proper clearing.
   *
   * No explicit domain set — cookies are scoped to the exact origin host.
   * This works because the Next.js frontend proxies all API calls through
   * its own origin, making cross-port cookie sharing unnecessary.
   */
  private clearAuthCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      path: string;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    };

    res.clearCookie(AUTH_CONSTANTS.COOKIE_NAME, cookieOptions);
  }

  /**
   * Set the long-lived refresh token as an httpOnly cookie. Mirrors the
   * access-cookie attributes (httpOnly + Secure + SameSite, scoped to the
   * origin host) but with the 30d refresh TTL instead of the access TTL.
   */
  private setRefreshCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: this.refreshTokenService.getTtlSeconds() * 1000,
      path: '/',
    });
  }

  /** Clear the refresh cookie on logout — same attributes as setRefreshCookie. */
  private clearRefreshCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
  }

  /** Read the raw refresh token from the request cookie, if present. */
  private extractRefreshToken(req: Request): string | undefined {
    return req.cookies?.[AUTH_CONSTANTS.REFRESH_COOKIE_NAME];
  }

  /** Session metadata (ip + user-agent) recorded on refresh-token rows. */
  private refreshContext(req: Request): RefreshTokenContext {
    const ua = req.headers?.['user-agent'];
    return {
      ip: req.ip || req.socket?.remoteAddress || undefined,
      userAgent: Array.isArray(ua) ? ua.find(Boolean) : ua || undefined,
    };
  }

  /**
   * Issue a fresh refresh-token session cookie for a user who just logged in
   * (login / register / google). Best-effort: a refresh-token write failure
   * must never block the access-token login the caller already completed.
   */
  private async startRefreshSession(res: Response, req: Request, userId: string): Promise<void> {
    try {
      const issued = await this.refreshTokenService.issueForUser(userId, this.refreshContext(req));
      this.setRefreshCookie(res, issued.rawToken);
    } catch {
      // Non-fatal — the user is logged in via the access cookie regardless.
    }
  }

  // Environment-aware rate limits: STRICT in production, RELAXED in dev/test
  @ApiOperation({ summary: 'Register a new user and organization' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Auth token set as httpOnly cookie.',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Public()
  @Post('register')
  @Throttle({
    default: {
      limit: RATE_LIMIT_STRICT,
      ttl: RATE_LIMIT_TTL_MS
    }
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const result = await this.authService.register(dto, clientIp, req.headers?.['user-agent']);

    // Set httpOnly cookie with JWT token
    this.setAuthCookie(res, result.token);

    // Start a rotating refresh-token session alongside the access token.
    await this.startRefreshSession(res, req, result.user.id);

    // Return response with token in body (for mobile clients) and cookie (for web)
    return {
      success: true,
      data: {
        access_token: result.token,
        user: result.user,
        organization: result.organization,
        expiresIn: result.expiresIn,
      },
    };
  }

  // Environment-aware rate limits: STRICT in production, RELAXED in dev/test
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Auth token set as httpOnly cookie.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account inactive' })
  @Public()
  @Post('login')
  @Throttle({
    default: {
      limit: RATE_LIMIT_STANDARD,
      ttl: RATE_LIMIT_TTL_MS
    }
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: req.ip || req.socket?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'],
    });

    // Set httpOnly cookie with JWT token
    this.setAuthCookie(res, result.token);

    // Start a rotating refresh-token session alongside the access token.
    await this.startRefreshSession(res, req, result.user.id);

    // Return response with token in body (for mobile clients) and cookie (for web)
    return {
      success: true,
      data: {
        access_token: result.token,
        user: result.user,
        expiresIn: result.expiresIn,
      },
    };
  }

  @ApiOperation({ summary: 'Login or register with Google OAuth' })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Google login successful. Auth token set as httpOnly cookie.',
  })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  @Public()
  @Post('google')
  @Throttle({
    default: {
      limit: RATE_LIMIT_STRICT,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(dto.credential, {
      ipAddress: req.ip || req.socket?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'],
    });

    // Set httpOnly cookie with JWT token
    this.setAuthCookie(res, result.token);

    // Start a rotating refresh-token session alongside the access token.
    await this.startRefreshSession(res, req, result.user.id);

    return {
      success: true,
      data: {
        access_token: result.token,
        user: result.user,
        expiresIn: result.expiresIn,
        isNewUser: result.isNewUser,
      },
    };
  }

  @ApiOperation({ summary: 'Refresh authentication token' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully. Refresh-token session rotated.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  // PUBLIC by design (PR-17b): the access token is now short-lived, so a
  // refresh must succeed AFTER the access token has expired — there is no
  // authenticated caller to guard on. The refresh cookie IS the credential:
  // rotate() derives the user from the token itself and re-verifies the user's
  // live state (isActive + user_revoked + pwd_changed) before minting anything.
  // No refresh cookie → the caller is simply unauthenticated → 401.
  @Public()
  @Post('refresh')
  @Throttle({
    default: {
      limit: RATE_LIMIT_REFRESH,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presentedRefreshToken = this.extractRefreshToken(req);
    if (!presentedRefreshToken) {
      // Public route with no refresh cookie is just an unauthenticated request.
      throw new UnauthorizedException('No refresh token');
    }

    // Rotate the refresh-token session FIRST: a rotation failure (reuse
    // detection / expiry / revoked-or-inactive user) must short-circuit to 401
    // without minting a new access token. The user is taken from the token
    // itself — the token is the sole credential on this public route.
    const rotated = await this.refreshTokenService.rotate(
      presentedRefreshToken,
      this.refreshContext(req),
    );
    this.setRefreshCookie(res, rotated.rawToken);

    // Extract the (possibly-expired) current access token so it can be revoked.
    const currentToken =
      req.cookies?.[AUTH_CONSTANTS.COOKIE_NAME] ||
      req.headers.authorization?.replace('Bearer ', '');

    const result = await this.authService.refresh(rotated.userId, currentToken);

    // Set new httpOnly cookie with refreshed JWT token
    this.setAuthCookie(res, result.token);

    return {
      success: true,
      data: {
        expiresIn: result.expiresIn,
      },
    };
  }

  @ApiOperation({ summary: 'Logout and clear authentication' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully. Auth cookie cleared.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract the token from cookie or Authorization header for revocation
    const token =
      req.cookies?.[AUTH_CONSTANTS.COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : undefined);

    const result = await this.authService.logout(userId, token);

    // Revoke the refresh-token session so logout is real (not just a cookie
    // clear) — a stolen refresh cookie can no longer be redeemed after logout.
    const presentedRefreshToken = this.extractRefreshToken(req);
    if (presentedRefreshToken) {
      await this.refreshTokenService.revokeByRawToken(presentedRefreshToken);
    }

    // Clear the auth + refresh cookies
    this.clearAuthCookie(res);
    this.clearRefreshCookie(res);

    return {
      success: true,
      ...result,
    };
  }

  @ApiOperation({ summary: 'List active login sessions for the authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Active refresh-token sessions (no token material exposed).' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const sessions = await this.refreshTokenService.listSessions(
      userId,
      this.extractRefreshToken(req),
    );
    return { success: true, data: { sessions } };
  }

  @ApiOperation({ summary: 'Revoke all OTHER sessions for the authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Other sessions revoked; the current session is kept.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const revokedCount = await this.refreshTokenService.revokeOtherSessions(
      userId,
      this.extractRefreshToken(req),
    );
    return { success: true, data: { revokedCount } };
  }

  @ApiOperation({ summary: 'Revoke a specific session by id (idempotent, scoped to the caller)' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description:
      'Session revoked (idempotent — same response whether the id was owned, already revoked, or does not exist for this user).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    await this.refreshTokenService.revokeSession(userId, sessionId);
    return { success: true, data: { message: 'Session revoked.' } };
  }

  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Current user data.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const { passwordHash, password, ...safeUser } = user || {} as any;
    // A stored avatar key resolves to the authenticated proxy URL; the actual
    // bytes are streamed by GET /auth/me/avatar (PR-7b).
    const avatarUrl = safeUser.avatar ? AuthController.AVATAR_URL_PATH : null;
    return {
      success: true,
      data: { user: { ...safeUser, avatarUrl } },
    };
  }

  @ApiOperation({ summary: 'Stream the authenticated user avatar image' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Avatar image stream.' })
  @ApiResponse({ status: 404, description: 'No avatar set.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('me/avatar')
  @SkipEnvelope()
  @SkipOutputSanitize()
  async getAvatar(
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const avatar = await this.authService.getAvatarStream(userId);
    if (!avatar) {
      throw new NotFoundException('No avatar set');
    }

    res.set({
      'Content-Type': avatar.contentType,
      ...(avatar.contentLength ? { 'Content-Length': String(avatar.contentLength) } : {}),
      // Same-origin (via the Next proxy); revalidate so a logged-out→logged-in
      // switch on a shared browser can't show the previous user's avatar.
      'Cache-Control': 'private, no-cache',
    });

    await pipeline(avatar.stream, res);
  }

  @ApiOperation({ summary: 'Update profile (name) for authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!dto.firstName && !dto.lastName) {
      throw new BadRequestException('At least one field (firstName or lastName) is required');
    }
    const user = await this.authService.updateProfile(userId, dto);
    return { success: true, data: { user } };
  }

  @ApiOperation({ summary: 'Upload avatar for authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    await this.authService.uploadAvatar(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
    // Cache-buster so the freshly-uploaded image reloads immediately even
    // though the proxy URL path is stable.
    const avatarUrl = `${AuthController.AVATAR_URL_PATH}?v=${Date.now()}`;
    return { success: true, data: { avatarUrl } };
  }

  @ApiOperation({ summary: 'Delete avatar for authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(
    @CurrentUser('id') userId: string,
  ) {
    await this.authService.deleteAvatar(userId);
    return { success: true, data: { message: 'Avatar deleted successfully.' } };
  }

  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return {
      success: true,
      data: {
        message: 'Password changed successfully.',
      },
    };
  }

  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'If the email exists, a reset link has been sent.' })
  @Public()
  @Post('forgot-password')
  @Throttle({
    default: {
      limit: RATE_LIMIT_STANDARD,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always return success to prevent email enumeration
    return {
      success: true,
      data: {
        message: 'If an account exists with this email, a reset link has been sent.',
      },
    };
  }

  @ApiOperation({ summary: 'Validate a password reset token' })
  @ApiResponse({ status: 200, description: 'Token validation result.' })
  @Public()
  @Get('validate-reset-token')
  @Throttle({
    // Match the reset-password POST cap. Without a throttle here an
    // attacker could brute-force the token via the GET (no body, no
    // CSRF, public endpoint) — and the responses are deterministic
    // enough to oracle (200 + {valid:true|false}).
    default: {
      limit: RATE_LIMIT_STANDARD,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async validateResetToken(@Req() req: Request) {
    const token = req.query.token as string;
    if (!token) {
      return {
        success: true,
        data: { valid: false },
      };
    }
    const result = await this.authService.validateResetToken(token);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token.' })
  @Public()
  @Post('reset-password')
  @Throttle({
    default: {
      limit: RATE_LIMIT_STANDARD,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      success: true,
      data: {
        message: 'Password has been reset successfully.',
      },
    };
  }

  @ApiOperation({ summary: 'Delete account permanently' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiBody({ type: DeleteAccountDto })
  @ApiResponse({ status: 200, description: 'Account deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Incorrect password.' })
  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: RATE_LIMIT_STRICT,
      ttl: RATE_LIMIT_TTL_MS,
    },
  })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(userId, dto.password);

    // Clear auth cookie
    this.clearAuthCookie(res);

    return {
      success: true,
      data: {
        message: 'Account deleted successfully.',
      },
    };
  }
}
