import { Controller, Get, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { resolveEffectiveContent, serializeDeviceContent } from '@vizora/database';
import { Public } from '../auth/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';
import {
  getDeviceTokenFromRequest,
  verifyCurrentDeviceToken,
} from '../common/device-token-auth.util';

function resolveContentBaseUrl(): string {
  const configured = process.env.API_BASE_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_BASE_URL must be set in production');
  }
  return 'http://localhost:3000';
}

@Controller('devices/me')
export class DeviceMeController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * T2 pull-on-connect: the device pulls its AUTHORITATIVE effective content (the
   * same resolver both channels use — schedule ?? currentPlaylist), serialized through
   * the SAME wire serializer the realtime push uses, so pull and push are byte-identical.
   *
   * Security (mirrors enforce #4/#5 — device-JWT self-identity): org and displayId come
   * SOLELY from the verified device JWT (`payload.sub` / `payload.organizationId`,
   * JWT-verified + DB-cross-checked inside verifyCurrentDeviceToken) — never a query
   * param or client-supplied id. So a device can only ever pull ITS OWN effective
   * content; it cannot retrieve another device's or another tenant's by shaping the
   * request. Runs under bypass (token verified in-handler), tenant-safe by construction.
   *
   * This is a per-connect/reconnect poll path → throttled against a fleet reconnect storm.
   */
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Get('content')
  async getMyContent(@Req() req: Request) {
    const token = getDeviceTokenFromRequest(req);
    const { payload } = await verifyCurrentDeviceToken({
      jwtService: this.jwtService,
      databaseService: this.db,
      token,
    });

    const effective = await resolveEffectiveContent(
      this.db,
      payload.sub, // the device's OWN displayId (JWT sub), never client-supplied
      payload.organizationId, // the device's OWN org (JWT + DB cross-checked)
      new Date(),
    );

    return serializeDeviceContent(effective, {
      contentBaseUrl: resolveContentBaseUrl(),
    });
  }
}
