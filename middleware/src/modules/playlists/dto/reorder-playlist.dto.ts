import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ReorderPlaylistDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  itemIds: string[];
}
