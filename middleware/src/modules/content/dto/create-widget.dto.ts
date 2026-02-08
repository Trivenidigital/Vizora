import { IsString, IsOptional, IsEnum, IsInt, IsObject, Min } from 'class-validator';

export class CreateWidgetDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum([
    'weather',
    'rss',
    'social_instagram',
    'social_twitter',
    'social_facebook',
    'clock',
    'countdown',
  ])
  widgetType!: string;

  @IsObject()
  widgetConfig!: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;
}
