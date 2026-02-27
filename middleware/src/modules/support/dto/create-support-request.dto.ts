import { IsString, IsNotEmpty, IsOptional, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class SupportContextDto {
  @IsOptional()
  @IsString()
  pageUrl?: string;

  @IsOptional()
  @IsString()
  browserInfo?: string;

  @IsOptional()
  @IsString()
  consoleErrors?: string;
}

export class CreateSupportRequestDto {
  @ApiProperty({ description: 'User message describing their issue or request' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @ApiProperty({ description: 'Auto-captured context', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => SupportContextDto)
  context?: SupportContextDto;
}
