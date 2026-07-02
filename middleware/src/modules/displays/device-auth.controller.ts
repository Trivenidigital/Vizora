import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { getDeviceTokenFromRequest } from '../common/device-token-auth.util';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DeviceAuthCheckThrottlerGuard } from './device-auth-check.throttler.guard';

/**
 * Device Revocation Contract v1.1 item 4.
 * GET /api/v1/devices/auth/check — sole authority for device credential
 * destruction. See DeviceAuthCheckService for the invariants.
 */
@Controller('devices/auth')
export class DeviceAuthController {
  constructor(private readonly authCheck: DeviceAuthCheckService) {}

  @Get('check')
  @Public() // device JWT verified manually; no user session
  @UseGuards(DeviceAuthCheckThrottlerGuard)
  @Throttle({ default: { limit: 2, ttl: 30000 } }) // 1/30s, burst 2, per token
  async check(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Manual response so status code + body + no-store are exact and cannot be
    // reshaped by a serializer or exception filter into a spurious terminal code.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    let token: string;
    try {
      token = getDeviceTokenFromRequest(req);
    } catch {
      // No bearer token at all → treat as an invalid credential, not revoked.
      res.status(401).json({ code: 'AUTH_INVALID' });
      return;
    }

    // A thrown error here (e.g. DB down) is intentionally NOT caught — it
    // propagates to Nest's exception layer as a 5xx, which the device reads as
    // transport-layer and leaves its credentials untouched. Converting it to a
    // 4xx/410 body would risk a false mass-unpair.
    const result = await this.authCheck.evaluate(token);
    res.status(result.httpStatus).json(result.body);
  }
}
