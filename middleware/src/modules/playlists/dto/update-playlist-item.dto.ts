import { IsOptional, IsInt, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlaylistItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  duration?: number;

  // Ensure at least one field is provided — reject empty body
  @ValidateIf((o) => o.duration === undefined)
  @IsInt({ message: 'At least one field (duration) must be provided' })
  private readonly _atLeastOne?: never;
}
