// WebSocket Message DTOs
// These DTOs provide type-safe validation for WebSocket message payloads

import { IsString, IsNumber, IsOptional, IsObject, ValidateNested, Min, Max, MaxLength, IsEnum, IsBoolean, IsArray, IsNotEmpty } from 'class-validator';
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

  // Device Revocation Contract v1.1: dark-screen detection. The player reports
  // which screen-state owns the glass and where its content came from, so the
  // fleet view can distinguish offline / on-but-dark / playing-stale. These MUST
  // be whitelisted here — the pipe runs forbidNonWhitelisted, so an enriched
  // heartbeat would otherwise be rejected and the device would look offline.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  screenState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  playbackSource?: string;
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
 * Screenshot response from device
 * MaxLength aligned with runtime check: 2MB base64 = ~2,796,203 chars
 */
export class ScreenshotResponseDto {
  @IsString()
  requestId: string;

  @IsString()
  @MaxLength(2 * 1024 * 1024)
  imageData: string;

  @IsNumber()
  @Min(1)
  width: number;

  @IsNumber()
  @Min(1)
  height: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
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

/**
 * DTO for join:organization event
 */
export class JoinOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}

/**
 * DTO for join:room event
 */
export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  room: string;
}

/**
 * DTO for leave:room event
 */
export class LeaveRoomDto {
  @IsString()
  @IsNotEmpty()
  room: string;
}
