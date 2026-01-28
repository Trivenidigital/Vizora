import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ThumbnailService } from './thumbnail.service';

@Module({
  controllers: [ContentController],
  providers: [ContentService, ThumbnailService],
  exports: [ContentService],
})
export class ContentModule {}
