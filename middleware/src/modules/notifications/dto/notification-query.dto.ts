import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  read?: string;

  @IsOptional()
  @IsString()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;
}
