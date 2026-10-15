import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PlaylistItemDto {
  @IsNotEmpty()
  @IsString()
  contentId!: string;

  // @Type alone coerces but validates nothing: 'abc' became NaN and was stored.
  // order is 0-based (the service defaults it to the array index).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  // Same bounds as AddPlaylistItemDto / UpdatePlaylistItemDto.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
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
  loop?: boolean;

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
