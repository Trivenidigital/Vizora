import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * A handler must not mix `@Query() dto: SomeDto` with a bare `@Query('name')`.
 *
 * The global ValidationPipe runs with `whitelist: true` AND
 * `forbidNonWhitelisted: true` (main.ts). `@Query() dto: SomeDto` validates the
 * WHOLE query object, not just the fields the DTO happens to declare — so every
 * additional named parameter is an unknown property and the request is rejected
 * before the handler ever runs:
 *
 *   GET /api/v1/audit-logs?page=1&limit=20&startDate=2026-10-10
 *   -> 400 {"message":["property startDate should not exist"]}
 *   GET /api/v1/schedules?page=1&limit=10&isActive=true
 *   -> 400 {"message":["property isActive should not exist"]}
 *
 * Both were live on 2026-10-09. All five audit-log filters and all three
 * schedule filters were dead, and the failure is SILENT from the operator's
 * seat: the audit-log page catches the 400, toasts "Failed to load audit logs"
 * and leaves the previous rows on screen, so the filter appears to do nothing
 * while the data shown is unfiltered.
 *
 * The fix is always the same — declare the parameters on the DTO
 * (AuditLogQueryDto, ScheduleQueryDto) instead of adding another bare
 * `@Query('x')`. This scan exists because the unit tests CANNOT catch a
 * reintroduction: they call controller methods directly and never run the
 * ValidationPipe, so a reintroduced bare `@Query('x')` passes every one of them
 * and only fails over HTTP.
 */
describe('controller query-parameter policy', () => {
  const repoRoot = join(__dirname, '..', '..', '..', '..');

  function controllerFiles(): string[] {
    // execFileSync with an argument array: no shell, so the glob reaches git
    // literally and nothing here is interpolated into a command string.
    const out = execFileSync('git', ['ls-files', 'src/**/*.controller.ts'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  /**
   * Parameter lists of every route handler in a controller, as raw text.
   * A handler starts at an HTTP-method decorator and its signature ends at the
   * `)` that closes the parameter list.
   */
  function handlerParamLists(source: string): string[] {
    const chunks: string[] = [];
    const methodDecorator = /@(Get|Post|Put|Patch|Delete|All|Head|Options)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = methodDecorator.exec(source)) !== null) {
      // Walk forward to the handler's own parameter list: the first '(' that
      // follows the method name on the line(s) after the decorator.
      const after = source.slice(match.index);
      const sigStart = after.indexOf('(', after.indexOf(')') + 1);
      if (sigStart === -1) continue;

      let depth = 0;
      let end = -1;
      for (let i = sigStart; i < after.length; i++) {
        if (after[i] === '(') depth++;
        else if (after[i] === ')') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) continue;
      chunks.push(after.slice(sigStart, end + 1));
    }
    return chunks;
  }

  const files = controllerFiles();

  it('finds the controllers to scan', () => {
    // Reach control. Without this a broken glob reports zero violations and
    // the policy below passes while measuring nothing.
    expect(files.length).toBeGreaterThan(10);
  });

  it('parses handler parameter lists that really do use @Query() with a DTO', () => {
    // Second reach control: the parser must actually find the construct this
    // policy is about, or "no violations" is again vacuous.
    const withQueryDto = files.flatMap((rel) =>
      handlerParamLists(readFileSync(join(repoRoot, rel), 'utf8')).filter((p) =>
        /@Query\(\)\s*\w+\s*:\s*\w+/.test(p),
      ),
    );
    expect(withQueryDto.length).toBeGreaterThan(0);
  });

  it('never mixes a whole-object @Query() DTO with a named @Query() parameter', () => {
    const violations: string[] = [];

    for (const rel of files) {
      const source = readFileSync(join(repoRoot, rel), 'utf8');
      for (const params of handlerParamLists(source)) {
        const hasWholeObjectDto = /@Query\(\)\s*\w+\s*:\s*\w+/.test(params);
        const named = params.match(/@Query\(\s*['"]([^'"]+)['"]\s*\)/g);
        if (hasWholeObjectDto && named) {
          violations.push(
            `${rel}: a handler takes @Query() with a DTO alongside ${named.join(', ')}. ` +
              `forbidNonWhitelisted will reject those parameters with 400 - declare them on the DTO instead.`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
