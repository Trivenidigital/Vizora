import { IsString, IsOptional, MaxLength, MinLength, IsUUID } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;
}
