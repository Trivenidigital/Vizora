import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const VALID_ORIENTATIONS = ['landscape', 'portrait'] as const;
export const PROVISIONING_TEMPLATE_NAME_MAX = 120;
export const PROVISIONING_TEMPLATE_DESCRIPTION_MAX = 500;

export class CreateProvisioningTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(PROVISIONING_TEMPLATE_NAME_MAX)
  name!: string;

  @IsString()
  @MaxLength(PROVISIONING_TEMPLATE_DESCRIPTION_MAX)
  @IsOptional()
  description?: string;

  @IsIn(VALID_ORIENTATIONS, { message: `defaultOrientation must be one of: ${VALID_ORIENTATIONS.join(', ')}` })
  @IsOptional()
  defaultOrientation?: 'landscape' | 'portrait';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @IsOptional()
  defaultTimezone?: string;

  /**
   * Optional default playlist applied to displays paired with this template.
   * Cross-org guard at the service layer.
   */
  @IsString()
  @MinLength(1)
  @IsOptional()
  defaultPlaylistId?: string;

  /**
   * UI hint: the operator's "go-to" template. Not unique-enforced; the UI
   * picks one to highlight. Multiple defaults are tolerated.
   */
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
