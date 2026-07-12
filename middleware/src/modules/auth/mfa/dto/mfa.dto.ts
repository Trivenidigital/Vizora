import { IsBoolean, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * A single MFA verification code. Accepts EITHER a 6-digit TOTP or a formatted
 * single-use backup code (e.g. `abcde-12345`), so the bound is loose on purpose.
 * The service decides which kind it is.
 */
export class MfaCodeDto {
  @ApiProperty({ description: 'A 6-digit TOTP code or a single-use backup code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(64)
  code: string;
}

/** Body for POST /auth/mfa/enable — verifies the pending secret. */
export class EnableMfaDto extends MfaCodeDto {}

/** Body for POST /auth/mfa/disable — requires a valid TOTP or backup code. */
export class DisableMfaDto extends MfaCodeDto {}

/** Body for POST /auth/mfa/backup-codes/regenerate — requires a valid TOTP. */
export class RegenerateBackupCodesDto extends MfaCodeDto {}

/** Body for POST /auth/mfa/challenge — completes an MFA-gated login. */
export class MfaChallengeDto {
  @ApiProperty({ description: 'The short-lived challenge token returned by /auth/login' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  challengeToken: string;

  @ApiProperty({ description: 'A 6-digit TOTP code or a single-use backup code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(64)
  code: string;
}

/** Body for the org admin endpoint that toggles per-org MFA enforcement. */
export class SetMfaRequiredDto {
  @ApiProperty({ description: 'Whether all members of the org must use MFA', example: true })
  @IsBoolean()
  mfaRequired: boolean;
}
