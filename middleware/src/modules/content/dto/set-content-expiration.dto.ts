import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SetContentExpirationDto {
  @IsDateString()
  expiresAt: string;

  @IsOptional()
  @IsString()
  replacementContentId?: string;
}
