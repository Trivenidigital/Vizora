import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class BulkDisplayIdsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  displayIds: string[];
}

export class BulkAssignPlaylistDto extends BulkDisplayIdsDto {
  @IsString()
  playlistId: string;
}

export class BulkAssignGroupDto extends BulkDisplayIdsDto {
  @IsString()
  displayGroupId: string;
}
