import { Controller, Post, Body, UseGuards, Get, Res } from '@nestjs/common';
import { Response } from 'express';
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
import { RegisterDto, LoginDto } from './dto';
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(userId);

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(userId);

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
}
