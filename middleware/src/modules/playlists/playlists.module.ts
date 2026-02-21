import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [HttpModule, BillingModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
