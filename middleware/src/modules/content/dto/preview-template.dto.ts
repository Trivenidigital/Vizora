import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DataSourceDto } from './create-template.dto';

/**
 * DTO for previewing a template with data
 */
export class PreviewTemplateDto {
  @IsString()
  templateHtml!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DataSourceDto)
  dataSource?: DataSourceDto;

  @IsOptional()
  @IsObject()
  sampleData?: Record<string, any>;
}
