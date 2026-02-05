import { IsString, IsOptional, MaxLength, MinLength, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;
}
