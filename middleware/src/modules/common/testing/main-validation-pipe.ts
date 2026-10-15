import { ValidationPipe } from '@nestjs/common';

/**
 * The global ValidationPipe exactly as main.ts registers it (error messages
 * left ON so tests can assert them). For PIPE-LEVEL DTO tests: plainToInstance
 * alone skips whitelist/forbidNonWhitelisted and does not reproduce the pipe's
 * ordering of implicit conversion and @Transform, and both have shipped bugs
 * that a plainToInstance-only test passed. main-validation-pipe.spec.ts pins
 * these options against main.ts.
 */
export const MAIN_VALIDATION_PIPE_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
} as const;

export function createMainValidationPipe(): ValidationPipe {
  return new ValidationPipe(MAIN_VALIDATION_PIPE_OPTIONS);
}

/** Run `value` through the main pipe as a `@Query()` or `@Body()` DTO. */
export function runMainPipe<T>(
  metatype: new () => T,
  value: unknown,
  type: 'query' | 'body' = 'body',
): Promise<T> {
  return createMainValidationPipe().transform(value, { type, metatype, data: '' });
}
