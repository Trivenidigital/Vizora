import { IsArray, IsString, ArrayMinSize, IsUUID } from 'class-validator';

export class MoveContentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  contentIds: string[];
}
