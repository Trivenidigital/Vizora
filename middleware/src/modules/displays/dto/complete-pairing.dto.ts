import { IsString, IsOptional, Length } from 'class-validator';

export class CompletePairingDto {
  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @IsOptional()
  nickname?: string;
}
