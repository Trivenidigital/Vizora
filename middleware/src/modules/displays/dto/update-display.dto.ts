import { PartialType } from '@nestjs/mapped-types';
import { CreateDisplayDto } from './create-display.dto';

export class UpdateDisplayDto extends PartialType(CreateDisplayDto) {}
