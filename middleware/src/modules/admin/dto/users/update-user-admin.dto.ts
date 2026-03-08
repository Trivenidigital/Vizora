import { IsString, IsOptional, IsBoolean, IsIn, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserAdminDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  @IsIn(['admin', 'manager', 'viewer'])
  role?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
