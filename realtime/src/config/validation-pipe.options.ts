import type { ValidationPipeOptions } from '@nestjs/common';

/**
 * The global HTTP ValidationPipe options (main.ts). Exported so the internal-API
 * contract tests run middleware's real payloads through the exact pipe the
 * gateway uses: `whitelist` strips any property a DTO does not decorate, so a
 * nested DTO whose @Type is not honoured loses every key.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
};
