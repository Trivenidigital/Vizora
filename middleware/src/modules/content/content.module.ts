import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { TemplateRenderingService } from './template-rendering.service';
import { TemplateRefreshService } from './template-refresh.service';

@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    ThumbnailService,
    FileValidationService,
    TemplateRenderingService,
    TemplateRefreshService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
