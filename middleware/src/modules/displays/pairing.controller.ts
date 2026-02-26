import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('status/:code')
  async checkPairingStatus(@Param('code') code: string) {
    return this.pairingService.checkPairingStatus(code);
  }

  /**
   * User completes pairing from web dashboard (Authenticated)
   */
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
  @Get('active')
  async getActivePairings(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.pairingService.getActivePairings(organizationId);
  }
}
