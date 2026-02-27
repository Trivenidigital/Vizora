import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SupportQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'in_progress', 'resolved', 'closed', 'wont_fix'])
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(['bug_report', 'feature_request', 'help_question', 'template_request', 'feedback', 'urgent_issue', 'account_issue'])
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
