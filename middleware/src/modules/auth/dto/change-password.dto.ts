import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StrongPassword } from './password.validation';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password (min 8 characters, must contain uppercase, lowercase, and number or special character)' })
  @StrongPassword()
  newPassword: string;
}
