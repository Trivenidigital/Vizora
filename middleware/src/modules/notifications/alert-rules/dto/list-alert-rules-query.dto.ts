import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { TRIGGER_EVENTS, TriggerEvent } from '../alert-rule.types';

export class ListAlertRulesQueryDto {
  /**
   * If supplied, returns only rules with matching `isActive`. Query strings
   * arrive as text ("true" / "false") — Transform handles the coercion.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(TRIGGER_EVENTS)
  triggerEvent?: TriggerEvent;
}
