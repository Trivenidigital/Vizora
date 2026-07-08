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
import { getAccessTokenTtlSeconds } from './jwt-expiry';

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
            // Resolved to a bounded whole-seconds NUMBER (never a unitless string,
            // which jsonwebtoken would read as milliseconds). See
            // resolveAccessTokenTtlSeconds — capped at the revocation-marker TTL.
            expiresIn: getAccessTokenTtlSeconds(),
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
