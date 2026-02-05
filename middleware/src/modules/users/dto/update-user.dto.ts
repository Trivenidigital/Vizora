import { IsOptional, IsString, IsIn, IsBoolean, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsIn(['admin', 'manager', 'viewer'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
