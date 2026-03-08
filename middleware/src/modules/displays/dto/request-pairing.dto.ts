import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class RequestPairingDto {
  @IsNotEmpty()
  @IsString()
  deviceIdentifier: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
