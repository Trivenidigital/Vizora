import { IsArray, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AssignTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  tagIds!: string[];
}

export class RemoveTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  tagIds!: string[];
}
