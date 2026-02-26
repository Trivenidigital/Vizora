import { Controller, Post, Body, UseGuards, Get, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AUTH_CONSTANTS } from './constants/auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
      maxAge: AUTH_CONSTANTS.TOKEN_EXPIRY_MS,
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
      limit: process.env.NODE_ENV === 'production' ? 3 : 1000,
      ttl: 60000
    }
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const result = await this.authService.register(dto, clientIp);

    // Set httpOnly cookie with JWT token
    this.setAuthCookie(res, result.token);

    // Return response without token in body (token is in cookie)
    return {
      success: true,
      data: {
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
      limit: process.env.NODE_ENV === 'production' ? 5 : 1000,
      ttl: 60000
    }
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Set httpOnly cookie with JWT token
    this.setAuthCookie(res, result.token);

    // Return response without token in body (token is in cookie)
    return {
      success: true,
      data: {
        user: result.user,
        expiresIn: result.expiresIn,
      },
    };
  }

  @ApiOperation({ summary: 'Refresh authentication token' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract the current token so it can be revoked
    const currentToken =
      req.cookies?.[AUTH_CONSTANTS.COOKIE_NAME] ||
      req.headers.authorization?.replace('Bearer ', '');

    const result = await this.authService.refresh(userId, currentToken);

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

    // Clear the auth cookie
    this.clearAuthCookie(res);

    return {
      success: true,
      ...result,
    };
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
  async getMe(@CurrentUser() user: any) {
    const { passwordHash, password, ...safeUser } = user || {};
    return {
      success: true,
      data: { user: safeUser },
    };
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
      limit: process.env.NODE_ENV === 'production' ? 5 : 1000,
      ttl: 60000,
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
      limit: process.env.NODE_ENV === 'production' ? 5 : 1000,
      ttl: 60000,
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
}
