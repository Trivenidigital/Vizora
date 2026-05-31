import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * O10 — Approval pipeline DTOs.
 *
 * - SubmitForApprovalDto: optional submission note (e.g. "ready for review,
 *   please check the legal disclaimer at the end")
 * - ApproveContentDto:    optional approval note (e.g. "looks good, ship it")
 * - RejectFromApprovalDto: REQUIRED rejection reason (≥3 chars; an empty
 *   reason would make rejected content untracable, so we enforce it at the
 *   DTO AND at the service)
 */

export class SubmitForApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ApproveContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectFromApprovalDto {
  @IsString()
  @MinLength(3, { message: 'rejection reason must be at least 3 characters' })
  @MaxLength(2000)
  reason!: string;
}
