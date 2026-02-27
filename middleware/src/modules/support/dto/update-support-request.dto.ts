import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSupportRequestDto {
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
  resolutionNotes?: string;
}
