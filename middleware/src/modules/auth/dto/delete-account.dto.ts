import { IsNotEmpty, IsString, Equals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ description: 'Must be exactly "DELETE MY ACCOUNT"' })
  @IsNotEmpty()
  @IsString()
  @Equals('DELETE MY ACCOUNT', { message: 'Confirmation must be exactly "DELETE MY ACCOUNT"' })
  confirmation: string;
}
