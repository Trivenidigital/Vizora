import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';

@Module({
  controllers: [ContentController],
  providers: [ContentService, ThumbnailService, FileValidationService],
  exports: [ContentService],
})
export class ContentModule {}
