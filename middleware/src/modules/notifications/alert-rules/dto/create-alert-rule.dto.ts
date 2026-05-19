import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import {
  TRIGGER_EVENTS,
  TriggerEvent,
  SCOPES,
  Scope,
  MIN_OFFLINE_SEC_FLOOR,
  MAX_RECIPIENTS_PER_RULE,
} from '../alert-rule.types';
import { CreateRecipientDto } from './create-recipient.dto';

export class CreateAlertRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(TRIGGER_EVENTS, { message: `triggerEvent must be one of: ${TRIGGER_EVENTS.join(', ')}` })
  triggerEvent!: TriggerEvent;

  @IsIn(SCOPES, { message: `scope must be one of: ${SCOPES.join(', ')}` })
  scope!: Scope;

  /** Required when scope=tag. Cross-org existence is checked at the service layer. */
  @ValidateIf((o) => o.scope === 'tag')
  @IsString()
  scopeTagId?: string;

  /** Required when scope=group. */
  @ValidateIf((o) => o.scope === 'group')
  @IsString()
  scopeGroupId?: string;

  /** Required when scope=display. */
  @ValidateIf((o) => o.scope === 'display')
  @IsString()
  scopeDisplayId?: string;

  /**
   * Debounce floor. The stale-heartbeat cron only emits device.offline after
   * 120s, so values below that would be silently no-ops.
   */
  @IsInt()
  @Min(MIN_OFFLINE_SEC_FLOOR, {
    message: `minOfflineSec must be >= ${MIN_OFFLINE_SEC_FLOOR} (stale-heartbeat cron threshold)`,
  })
  @IsOptional()
  minOfflineSec?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'at least one recipient is required' })
  @ArrayMaxSize(MAX_RECIPIENTS_PER_RULE, {
    message: `at most ${MAX_RECIPIENTS_PER_RULE} recipients per rule`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipientDto)
  recipients!: CreateRecipientDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
