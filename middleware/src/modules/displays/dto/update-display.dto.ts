import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional } from 'class-validator';
import { CreateDisplayDto } from './create-display.dto';

export class UpdateDisplayDto extends PartialType(CreateDisplayDto) {
  @IsOptional()
  @IsString()
  currentPlaylistId?: string;
}
