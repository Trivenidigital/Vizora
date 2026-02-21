import { Module } from '@nestjs/common';
import { TemplateLibraryController } from './template-library.controller';
import { TemplateLibraryService } from './template-library.service';
import { ContentModule } from '../content/content.module';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';

@Module({
  imports: [ContentModule],
  controllers: [TemplateLibraryController],
  providers: [TemplateLibraryService, SuperAdminGuard],
  exports: [TemplateLibraryService],
})
export class TemplateLibraryModule {}
