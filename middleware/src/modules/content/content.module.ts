import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { DeviceContentController } from './device-content.controller';
import { TemplatesController } from './controllers/templates.controller';
import { LayoutsController } from './controllers/layouts.controller';
import { WidgetsController } from './controllers/widgets.controller';
import { BulkOperationsController } from './controllers/bulk-operations.controller';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { TemplateRenderingService } from './template-rendering.service';
import { TemplateRefreshService } from './template-refresh.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { StorageModule } from '../storage/storage.module';
import {
  WeatherDataSource,
  RssDataSource,
  InstagramDataSource,
  TwitterDataSource,
  FacebookDataSource,
} from './widget-data-sources';

@Module({
  imports: [
    StorageModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.DEVICE_JWT_SECRET,
      }),
    }),
  ],
  controllers: [
    ContentController,
    DeviceContentController,
    TemplatesController,
    LayoutsController,
    WidgetsController,
    BulkOperationsController,
  ],
  providers: [
    ContentService,
    ThumbnailService,
    FileValidationService,
    TemplateRenderingService,
    TemplateRefreshService,
    DataSourceRegistryService,
    WeatherDataSource,
    RssDataSource,
    InstagramDataSource,
    TwitterDataSource,
    FacebookDataSource,
  ],
  exports: [ContentService, TemplateRenderingService],
})
export class ContentModule {}
