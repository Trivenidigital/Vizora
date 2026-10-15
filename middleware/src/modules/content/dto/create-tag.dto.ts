import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Tag colours are persisted as NAMES, not CSS values — the web ContentTagger
 * maps each name onto its categorical `--cat-*` tokens. This list must match
 * that component's `TAG_COLORS` exactly: a name outside it would render as the
 * fallback colour, silently changing what the operator picked.
 */
export const CONTENT_TAG_COLORS = ['blue', 'red', 'green', 'purple', 'yellow', 'pink'] as const;
export type ContentTagColor = (typeof CONTENT_TAG_COLORS)[number];

export class CreateTagDto {
  // Trimmed before validation so '   ' fails MinLength instead of persisting a
  // blank tag, and ' Promo' cannot sit beside 'Promo' as a distinct name.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTENT_TAG_COLORS)
  color?: ContentTagColor;
}
