import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class MoveContentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  contentIds: string[];
}
