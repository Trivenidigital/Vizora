import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PlaylistItemDto {
  @IsNotEmpty()
  @IsString()
  contentId!: string;

  @IsOptional()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @Type(() => Number)
  duration?: number;
}

export class CreatePlaylistDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaylistItemDto)
  items?: PlaylistItemDto[];
}
