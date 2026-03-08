import { IsNotEmpty, IsString, IsIn, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for requesting a screenshot from a device
 */
export class ScreenshotRequestDto {
  // Empty body - display ID comes from URL parameter
}

/**
 * DTO for screenshot request response
 */
export class ScreenshotResponseDto {
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsString()
  @IsIn(['pending', 'completed', 'failed'])
  status: 'pending' | 'completed' | 'failed';
}

/**
 * DTO for screenshot result
 */
export class ScreenshotResultDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  capturedAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;
}
