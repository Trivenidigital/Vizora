import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { SkipCsrf } from '../common/guards/csrf.guard';
import { PairingService } from './pairing.service';
import { RequestPairingDto } from './dto/request-pairing.dto';
import { CompletePairingDto } from './dto/complete-pairing.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('devices/pairing')
export class PairingController {
  constructor(private readonly pairingService: PairingService) {}

  /**
   * Display requests a pairing code (Public endpoint)
   * Skip CSRF - unpaired devices don't have CSRF tokens
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('request')
  async requestPairingCode(@Body() requestDto: RequestPairingDto) {
    return this.pairingService.requestPairingCode(requestDto);
  }

  /**
   * Display checks pairing status (Public endpoint)
   */
  @Public()
  // Device polls this every 2s during pairing = 30 req/min. NOW that the 'default'
  // throttler is registered (PD-4), this override actually fires — so it MUST clear
  // the poll rate or pairing 429s after ~20s. 40/min = headroom over the poll +
  // retries; safe (unauthenticated status read on an ephemeral 32^6 code, 5-15min TTL).
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Get('status/:code')
  async checkPairingStatus(@Param('code') code: string) {
    return this.pairingService.checkPairingStatus(code);
  }

  /**
   * User completes pairing from web dashboard (Authenticated)
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @RequiresSubscription()
  @Post('complete')
  async completePairing(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() completeDto: CompletePairingDto,
  ) {
    return this.pairingService.completePairing(
      organizationId,
      userId,
      completeDto,
    );
  }

  /**
   * Get active pairing requests for organization (Authenticated)
   */
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @Get('active')
  async getActivePairings(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.pairingService.getActivePairings(organizationId);
  }
}
