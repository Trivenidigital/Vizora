import { IsEmail, IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsIn(['admin', 'manager', 'viewer'])
  role: string;
}
