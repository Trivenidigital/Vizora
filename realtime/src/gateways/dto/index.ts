// WebSocket Message DTOs
// These DTOs provide type-safe validation for WebSocket message payloads

import { IsString, IsNumber, IsOptional, IsObject, ValidateNested, Min, Max, MaxLength, IsEnum, IsBoolean, IsArray, IsNotEmpty, ValidateIf } from 'class-validator';
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

  // Persisted onto devices.metadata.appVersion so the fleet view can show which
  // build each screen runs. It lands in JSONB, so bound it here — an unbounded
  // string from a device is an unbounded row.
  @IsOptional()
  @IsString()
  @MaxLength(64)
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

  // The effective-content version the device currently has rendered, so the
  // server can detect drift and answer with `reconcileContent`.
  //
  // NOT whitelisting this is what the comment above warns about, and it happened:
  // the player has sent `contentVersion` on EVERY heartbeat since v1.3.10
  // (vizora-tv src/main.ts, initialised to '' so it is always serialised, never
  // dropped as undefined), while this DTO never listed it. With
  // forbidNonWhitelisted the pipe rejected the payload before the handler ran, so
  // for four releases no heartbeat was processed: the Redis/DB status refresh and
  // appVersion persistence never executed and the ack never reached the device.
  //
  // The four-release window is established by the CODE: the client shipped
  // contentVersion in b08e3ae (2026-07-04), which is tagged into v1.3.10 through
  // v1.3.13, and the pipe rejects it deterministically.
  //
  // Production corroborates but proves less, and the distinction is worth keeping
  // honest: 0 devices carry metadata.appVersion, but persistAppVersionIfChanged
  // only landed 2026-08-11 and just 3 devices have heartbeated since, so the DB
  // speaks to a ~2-day window, not to four releases. Device rows still looked
  // recent throughout because handleConnection writes lastHeartbeat on CONNECT —
  // which is why this hid for so long.
  //
  // Bounded like appVersion: it is device-supplied and reaches a JSONB row.
  //
  // 64 is a CONTRACT ON THE GENERATOR, not a guess. The effective-content version
  // is an ISO-8601 timestamp — max(updatedAt) across the resolved content — which
  // is 24 chars and monotonic, so it compares correctly with the deployed client's
  // string `>` in vizora-tv utils.ts:56. Anyone writing a version generator MUST
  // keep that shape: a fixed-width hash or an ISO timestamp, never a per-item
  // concatenation. The client's own computePlaylistSignature style would exceed
  // this at two playlist items, and a version that changes without INCREASING is
  // silently ignored by the shipped client regardless of length.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contentVersion?: string;
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

  // BOTH shipped clients send `Date.now()` — a NUMBER:
  //   vizora-tv src/main.ts:1774, :1808, :2026
  //   display/src/electron/device-client.ts:552-554
  // This was declared `@IsString()`, so every impression either client has ever
  // emitted was rejected by the pipe before handleContentImpression ran. The
  // content_impressions table holds 0 rows, lifetime — the discriminating fact.
  //
  // Accept both rather than swapping one strict type for another: the number is
  // what is deployed in the field and cannot be changed retroactively, while an
  // ISO string is the more useful wire format for anything written later. The
  // handler already normalises.
  @IsOptional()
  @ValidateIf((o: ContentImpressionDto) => typeof o.timestamp !== 'number')
  @IsString()
  timestamp?: string | number;
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
