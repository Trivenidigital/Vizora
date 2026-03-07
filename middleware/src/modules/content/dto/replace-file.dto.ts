import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReplaceFileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  keepBackup?: boolean; // Whether to keep the old file as a previous version
}
