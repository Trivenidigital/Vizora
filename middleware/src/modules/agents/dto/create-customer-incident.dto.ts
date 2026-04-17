import { IsString, IsIn, IsUUID, MaxLength } from 'class-validator';

export class CreateCustomerIncidentDto {
  @IsUUID()
  organizationId!: string;

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

  @IsString()
  @MaxLength(1000)
  remediation!: string;
}
