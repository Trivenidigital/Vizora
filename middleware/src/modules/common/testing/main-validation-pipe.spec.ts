import { readFileSync } from 'fs';
import { join } from 'path';
import { MAIN_VALIDATION_PIPE_OPTIONS } from './main-validation-pipe';

// The pipe-level DTO tests are only evidence if their pipe IS main.ts's pipe.
describe('createMainValidationPipe mirrors main.ts', () => {
  const mainTs = readFileSync(join(__dirname, '..', '..', '..', 'main.ts'), 'utf8');

  it.each([
    `whitelist: ${MAIN_VALIDATION_PIPE_OPTIONS.whitelist}`,
    `forbidNonWhitelisted: ${MAIN_VALIDATION_PIPE_OPTIONS.forbidNonWhitelisted}`,
    `transform: ${MAIN_VALIDATION_PIPE_OPTIONS.transform}`,
    `enableImplicitConversion: ${MAIN_VALIDATION_PIPE_OPTIONS.transformOptions.enableImplicitConversion}`,
  ])('main.ts registers %s', (option) => {
    expect(mainTs).toContain(option);
  });
});
