import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ManageDisplaysDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  displayIds: string[];
}
