import {
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsIn,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommandTargetDto {
  @IsEnum(['device', 'group', 'organization'])
  type!: 'device' | 'group' | 'organization';

  @IsString()
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
}

export class SendCommandDto {
  @IsEnum(['reload', 'restart', 'reboot', 'clear_cache', 'push_content'])
  command!: string;

  @ValidateNested()
  @Type(() => CommandTargetDto)
  target!: CommandTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommandPayloadDto)
  payload?: CommandPayloadDto;
}
