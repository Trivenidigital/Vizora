import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

/**
 * organizationId is NOT accepted from the request body — it is extracted from
 * the authenticated caller's JWT by the controller and passed to the service
 * out-of-band. This prevents a caller from writing incidents attributed to
 * another org.
 */
export class CreateCustomerIncidentDto {
  @IsString()
  @MaxLength(64)
  agent!: string;

  @IsString()
  @MaxLength(64)
  type!: string;

  @IsIn(['critical', 'warning', 'info'])
  severity!: 'critical' | 'warning' | 'info';

  @IsString()
  @MaxLength(64)
  target!: string;

  @IsString()
  @MaxLength(128)
  targetId!: string;

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remediation?: string;
}
