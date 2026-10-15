import type { TransformFnParams } from 'class-transformer';

/**
 * `@Transform(toBooleanQuery)` for a boolean QUERY parameter.
 *
 * Reads the RAW value (`obj[key]`), never `value`. The global ValidationPipe
 * runs with `enableImplicitConversion`, and class-transformer 0.5.1 converts
 * BEFORE it calls @Transform, handing it `Boolean('false') === true`. So a
 * transform that inspects `value` — and `@Type(() => Boolean)` — turns
 * `?isActive=false` into `true`: the filter returns the exact opposite set.
 *
 * 'true'/true → true, 'false'/false → false. Anything else (`''`, `'1'`,
 * `'yes'`, a repeated key's array) is returned unchanged so the field's
 * @IsBoolean rejects it with a 400 — an ambiguous filter must not silently
 * pick a side. An absent key never reaches the transform, so it stays
 * undefined (no filter).
 */
export function toBooleanQuery({ obj, key }: TransformFnParams): unknown {
  const raw = obj[key];
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  return raw;
}
