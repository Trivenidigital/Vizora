import { PartialType } from '@nestjs/mapped-types';
import { CreateDisplayGroupDto } from './create-display-group.dto';

export class UpdateDisplayGroupDto extends PartialType(CreateDisplayGroupDto) {}
