import { IsNotEmpty, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class PushContentDto {
  @IsNotEmpty()
  @IsString()
  contentId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  duration?: number;
}
