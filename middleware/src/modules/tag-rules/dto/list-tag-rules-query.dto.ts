import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { toBooleanQuery } from '../../common/dto/boolean-query.transform';

export class ListTagRulesQueryDto {
  @IsOptional()
  @Transform(toBooleanQuery)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsString()
  playlistId?: string;
}
