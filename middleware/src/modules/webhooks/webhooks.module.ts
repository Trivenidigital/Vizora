import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksDispatcher } from './webhooks.dispatcher';

@Module({
  imports: [DatabaseModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksDispatcher],
  exports: [WebhooksService],
})
export class WebhooksModule {}
