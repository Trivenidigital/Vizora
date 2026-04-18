import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * organizationId is NOT accepted from the request body — it is extracted from
 * the authenticated caller's JWT by the controller and passed to the service
 * out-of-band. This prevents a caller from writing incidents attributed to
 * another org.
 *
 * R4-MED1: @IsNotEmpty() on required strings. Without it, @IsString() accepts
 * the empty string ('') which silently creates meaningless incidents.
 */
export class CreateCustomerIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  agent!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  type!: string;

  @IsIn(['critical', 'warning', 'info'])
  severity!: 'critical' | 'warning' | 'info';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  target!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remediation?: string;
}
