import { IsString, IsOptional, IsObject } from 'class-validator';

export class RequestPairingDto {
  @IsString()
  deviceIdentifier: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}
