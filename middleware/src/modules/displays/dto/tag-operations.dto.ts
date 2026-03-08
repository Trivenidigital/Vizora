import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AssignTagsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tagIds!: string[];
}

export class RemoveTagsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tagIds!: string[];
}
