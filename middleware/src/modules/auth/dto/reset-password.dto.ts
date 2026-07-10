import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StrongPassword } from './password.validation';

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123...' })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @ApiProperty({ example: 'NewStr0ngP@ss!' })
  @StrongPassword()
  newPassword: string;
}
