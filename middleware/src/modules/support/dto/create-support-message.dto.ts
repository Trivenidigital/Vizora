import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiProperty({ description: 'Client-generated idempotency key for safe retries', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientMutationId?: string;
}
