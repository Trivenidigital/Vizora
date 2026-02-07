import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { DeviceContentController } from './device-content.controller';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { TemplateRenderingService } from './template-rendering.service';
import { TemplateRefreshService } from './template-refresh.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.DEVICE_JWT_SECRET || process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [ContentController, DeviceContentController],
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
