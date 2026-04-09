import { IsString, IsNotEmpty, IsArray, IsOptional, IsObject, IsNumber, IsEnum, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceCommandType } from '../types';

export class PushPlaylistDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsObject()
  @IsNotEmpty()
  playlist!: Record<string, unknown>;
}

export class PushContentDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsObject()
  @IsNotEmpty()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class DeviceCommandDto {
  @IsEnum(DeviceCommandType)
  type!: DeviceCommandType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class BroadcastCommandDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  deviceIds!: string[];

  @ValidateNested()
  @Type(() => DeviceCommandDto)
  command!: DeviceCommandDto;
}

export class InternalCommandDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ValidateNested()
  @Type(() => DeviceCommandDto)
  command!: DeviceCommandDto;
}
