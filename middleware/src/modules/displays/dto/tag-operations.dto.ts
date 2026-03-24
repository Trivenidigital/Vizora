import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AssignTagsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  tagIds!: string[];
}

export class RemoveTagsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  tagIds!: string[];
}
