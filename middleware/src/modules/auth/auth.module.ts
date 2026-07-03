import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../database/database.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';

/**
 * Normalize a JWT expiry env value for jsonwebtoken's `expiresIn`.
 *
 * jsonwebtoken parses a UNITLESS string as milliseconds ("3600" → 3600ms ≈ 3.6s)
 * but a number as seconds. So `JWT_EXPIRES_IN=3600` (meant as 3600 seconds) would
 * silently mint 3.6-second tokens — a production logout storm. A pure-integer
 * value is therefore coerced to a Number (seconds); unit strings ("7d", "1h",
 * "30m") pass through unchanged. Returns undefined for empty/unset so the caller
 * can apply its default.
 */
export function coerceJwtExpiry(raw: string | undefined): string | number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const v = raw.trim();
  return /^\d+$/.test(v) ? Number(v) : v;
}

@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    // forwardRef because NotificationsModule's AlertRulesController uses
    // RolesGuard from this module (AuthModule). The forwardRef breaks the
    // would-be circular import at module-graph resolution time.
    forwardRef(() => NotificationsModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET environment variable is required and must be at least 32 characters',
          );
        }
        return {
          secret,
          signOptions: {
            // jsonwebtoken parses a UNITLESS string as milliseconds ("3600" =
            // 3600ms = 3.6s), but a number as seconds. So a bare-number env value
            // meant as "3600 seconds" silently becomes 3.6s tokens (a logout
            // storm). Coerce a pure-integer value to a Number (= seconds); leave
            // unit strings like "7d"/"1h" as-is.
            expiresIn: coerceJwtExpiry(process.env.JWT_EXPIRES_IN) ?? '7d',
            algorithm: 'HS256' as const,
          },
          verifyOptions: {
            algorithms: ['HS256' as const],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    RolesGuard,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
