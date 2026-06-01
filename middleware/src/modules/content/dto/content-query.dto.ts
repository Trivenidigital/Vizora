import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CONTENT_DATE_RANGES,
  CONTENT_LIST_STATUSES,
  CONTENT_LIST_TYPES,
  CONTENT_TEMPLATE_ORIENTATIONS,
  type ContentDateRange,
} from '../content-list-query';

const normalizeSearch = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeTagNames = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const normalized = raw
    .map((tagName) => String(tagName).trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeRepeatedStrings = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const normalized = raw
    .map((item) => String(item).trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

export class ContentQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(CONTENT_LIST_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTENT_LIST_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTENT_TEMPLATE_ORIENTATIONS)
  templateOrientation?: string;

  @IsOptional()
  @Transform(normalizeSearch)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTENT_DATE_RANGES)
  dateRange?: ContentDateRange;

  @IsOptional()
  @Transform(normalizeTagNames)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tagNames?: string[];

  @IsOptional()
  @Transform(normalizeRepeatedStrings)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tagIds?: string[];
}
