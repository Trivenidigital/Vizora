import { PartialType } from '@nestjs/mapped-types';
import { CreateTagRuleDto } from './create-tag-rule.dto';

/**
 * All fields optional via PartialType. Each retains its @IsX decorators
 * from CreateTagRuleDto.
 *
 * The service-layer `update()` also implements the "if priority OR isActive
 * OR tagId OR playlistId changes → re-sweep affected displays" rule.
 */
export class UpdateTagRuleDto extends PartialType(CreateTagRuleDto) {}
