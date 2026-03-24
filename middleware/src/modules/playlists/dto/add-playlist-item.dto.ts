import { IsNotEmpty, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AddPlaylistItemDto {
  @IsNotEmpty()
  @IsString()
  contentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  duration?: number;
}
