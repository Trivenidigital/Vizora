import { IsString, IsOptional, IsDateString, Matches } from 'class-validator';

export class BlockIpDto {
  @IsString()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, {
    message: 'ipAddress must be a valid IPv4 address or CIDR range',
  })
  ipAddress: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
