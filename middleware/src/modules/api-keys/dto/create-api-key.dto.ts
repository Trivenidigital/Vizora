import { IsString, IsNotEmpty, IsArray, IsOptional, IsDateString, IsIn } from 'class-validator';

/**
 * Allowlist of valid API-key scopes. Used by `@IsIn(VALID_SCOPES, ...)` on
 * the DTO so a caller can never invent privileged scopes like `admin:*`
 * or `delete:all` and get them stored on the key record. R10 api-keys
 * scout: previously `@IsString({ each: true })` accepted any string,
 * and downstream consumers would happily match the made-up scope.
 *
 * When adding a new scope: extend this list AND wire the corresponding
 * check in the relevant guard / controller. Don't ship scope strings
 * that no consumer checks.
 */
export const VALID_API_KEY_SCOPES = [
  'read:all',
  'read:content',
  'read:displays',
  'read:analytics',
  'write:content',
  'write:displays',
  'write:playlists',
  'write:schedules',
] as const;

export type ApiKeyScope = (typeof VALID_API_KEY_SCOPES)[number];

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsIn(VALID_API_KEY_SCOPES as unknown as string[], { each: true })
  @IsOptional()
  scopes?: ApiKeyScope[];

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
