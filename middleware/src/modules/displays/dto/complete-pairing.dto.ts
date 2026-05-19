import { IsString, IsOptional, Length, MinLength } from 'class-validator';

export class CompletePairingDto {
  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  location?: string;

  /**
   * O6 — Optional reference to a per-org ProvisioningTemplate. When set,
   * the template's defaultOrientation / defaultTimezone / defaultPlaylistId
   * are applied to the new Display at pair-complete time. Cross-org guard
   * runs at the service layer.
   */
  @IsString()
  @MinLength(1)
  @IsOptional()
  provisioningTemplateId?: string;
}
