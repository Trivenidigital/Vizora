import { Module } from '@nestjs/common';
import { TemplateLibraryController } from './template-library.controller';
import { TemplateLibraryService } from './template-library.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [ContentModule],
  controllers: [TemplateLibraryController],
  providers: [TemplateLibraryService],
  exports: [TemplateLibraryService],
})
export class TemplateLibraryModule {}
