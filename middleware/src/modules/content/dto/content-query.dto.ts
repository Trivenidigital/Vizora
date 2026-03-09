import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ContentQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['image', 'video', 'url', 'html', 'pdf', 'template'])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'archived', 'expired', 'draft'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['landscape', 'portrait', 'square'])
  templateOrientation?: string;
}
