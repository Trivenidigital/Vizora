import {
  IsString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsIn,
  IsNumber,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommandTargetDto {
  // 'tag' added in O1 — push to every display in the caller's org carrying
  // the given tagId. The fleet resolver looks up DisplayTag, cross-checks
  // org membership, and fans out via the same broadcast path.
  @IsEnum(['device', 'group', 'organization', 'tag'])
  type!: 'device' | 'group' | 'organization' | 'tag';

  @IsString()
  @IsNotEmpty({ message: 'target.id must be a non-empty string' })
  id!: string;
}

class CommandPayloadDto {
  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsNumber()
  @IsIn([15, 30, 60, 120, 240])
  duration?: number;

  @IsOptional()
  @IsEnum(['normal', 'emergency'])
  priority?: 'normal' | 'emergency';

  @IsOptional()
  @IsString()
  @IsUrl({
    require_protocol: true,
    require_tld: false,
    protocols: ['http', 'https'],
  })
  feedUrl?: string;
}

export class SendCommandDto {
  @IsEnum(['reload', 'restart', 'reboot', 'clear_cache', 'push_content', 'update'])
  command!: string;

  @ValidateNested()
  @Type(() => CommandTargetDto)
  target!: CommandTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommandPayloadDto)
  payload?: CommandPayloadDto;
}
