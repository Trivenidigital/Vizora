import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class ReplaceFileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  keepBackup?: boolean; // Whether to keep the old file as a previous version
}
