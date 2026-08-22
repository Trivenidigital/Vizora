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

  /**
   * REPAIR — rebind this live pairing session onto an EXISTING Display row
   * instead of creating a new one.
   *
   * The physical TV still initiates pairing and still receives the replacement
   * credential through its normal poller; the admin only selects WHICH logical
   * display row the session binds to. There is deliberately no server action
   * that mints or replaces a credential for an offline TV.
   *
   * Absent  → behaviour is byte-identical to the pre-repair pairing flow.
   * Present → `PairingService.completePairing` takes the rebind path: the target
   * row keeps its id, playlist, schedules, groups, tags, history and quota slot,
   * and only the fields describing the physical client are replaced. Mutually
   * exclusive with `provisioningTemplateId`, which would overwrite exactly the
   * tenant configuration a rebind exists to preserve.
   */
  @IsString()
  @MinLength(1)
  @IsOptional()
  targetDisplayId?: string;
}
