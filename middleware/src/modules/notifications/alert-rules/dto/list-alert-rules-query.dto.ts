import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { toBooleanQuery } from '../../../common/dto/boolean-query.transform';
import { TRIGGER_EVENTS, TriggerEvent } from '../alert-rule.types';

export class ListAlertRulesQueryDto {
  /**
   * If supplied, returns only rules with matching `isActive`. Query strings
   * arrive as text ("true" / "false") — Transform handles the coercion.
   */
  @IsOptional()
  @Transform(toBooleanQuery)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(TRIGGER_EVENTS)
  triggerEvent?: TriggerEvent;
}
