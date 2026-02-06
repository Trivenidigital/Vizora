import { IsString, MaxLength } from 'class-validator';

export class OrgNotesDto {
  @IsString()
  @MaxLength(5000)
  notes: string;
}
