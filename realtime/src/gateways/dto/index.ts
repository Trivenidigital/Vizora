// WebSocket Message DTOs
// These DTOs provide type-safe validation for WebSocket message payloads

import { IsString, IsNumber, IsOptional, IsObject, ValidateNested, Min, Max, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Device metrics included in heartbeat
 */
export class DeviceMetricsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  memoryUsage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diskUsage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  networkLatency?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

/**
 * Current content information in heartbeat
 */
export class CurrentContentDto {
  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  playlistId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  playbackPosition?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * Heartbeat message payload
 */
export class HeartbeatMessageDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceMetricsDto)
  metrics?: DeviceMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CurrentContentDto)
  currentContent?: CurrentContentDto;

  @IsOptional()
  @IsNumber()
  uptime?: number;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

/**
 * Content impression event
 */
export class ContentImpressionDto {
  @IsString()
  contentId: string;

  @IsOptional()
  @IsString()
  playlistId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  completionPercentage?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

/**
 * Content error types
 */
export enum ContentErrorType {
  LOAD_FAILED = 'load_failed',
  PLAYBACK_ERROR = 'playback_error',
  NETWORK_ERROR = 'network_error',
  DECODE_ERROR = 'decode_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

/**
 * Content error event
 */
export class ContentErrorDto {
  @IsString()
  contentId: string;

  @IsOptional()
  @IsString()
  playlistId?: string;

  @IsEnum(ContentErrorType)
  errorType: ContentErrorType;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

/**
 * Playlist request message
 */
export class PlaylistRequestDto {
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  @IsString()
  lastKnownVersion?: string;
}

/**
 * Response wrapper for WebSocket messages
 */
export interface WebSocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Create a successful WebSocket response
 */
export function createSuccessResponse<T>(data?: T): WebSocketResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error WebSocket response
 */
export function createErrorResponse(error: string): WebSocketResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}
