import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SuspendOrgDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}
