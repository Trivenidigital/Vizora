import { IsString, IsArray, IsOptional, IsInt, Min, Max, MinLength } from 'class-validator';

export class PublishTemplateDto {
  @IsString()
  @MinLength(1)
  renderedHtml!: string;

  @IsArray()
  @IsString({ each: true })
  displayIds!: string[];

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  duration?: number;
}
