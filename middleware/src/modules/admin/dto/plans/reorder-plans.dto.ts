import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PlanOrderItem {
  @IsString()
  id: string;

  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderPlansDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanOrderItem)
  plans: PlanOrderItem[];
}
