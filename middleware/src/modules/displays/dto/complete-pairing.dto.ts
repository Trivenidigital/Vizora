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
   * The admin only selects WHICH logical display row the session binds to; the
   * replacement credential is not returned to them. It is parked in the pairing
   * record for whoever polls `GET /devices/pairing/status/:code` — normally the
   * screen that is showing the code.
   *
   * That is routing, NOT a possession guarantee, and must not be written up as
   * one. `POST /devices/pairing/request` is `@Public()`, so the session
   * originates from whoever asked for the code rather than from a device that
   * proved anything. The platform separately already lets an admin or manager
   * mint a device credential with no TV involved (`POST /displays/:id/pair`
   * returns the plaintext JWT to the caller). Rebinding neither creates nor
   * closes that gap.
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
