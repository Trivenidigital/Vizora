import { IsEmail, IsString, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteUserDto {
  // Normalize so a mixed-case invite creates an account that later logins
  // (which lowercase the address) can actually match, and so the duplicate
  // check catches case-variants of an existing member.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
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
