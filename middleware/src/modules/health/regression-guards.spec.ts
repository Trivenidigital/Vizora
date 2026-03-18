/**
 * Regression guard tests — each test prevents a specific bug pattern from recurring.
 * These are static analysis tests that read source files — no database or server needed.
 * Named after the bug they prevent for easy tracing.
 */
import * as fs from 'fs';
import * as path from 'path';

const MODULES_DIR = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

// Helper: read a file if it exists
function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

describe('Regression Guards', () => {
  // -----------------------------------------------------------------------
  // BUG: ParseUUIDPipe rejecting Prisma CUID IDs
  // Root cause: Controllers used ParseUUIDPipe but Prisma models used @default(cuid())
  // Fix: ParseIdPipe accepts both UUID and CUID
  // -----------------------------------------------------------------------
  describe('CUID/UUID ID pipe mismatch', () => {
    let schema: string;
    let cuidModels: Set<string>;
    let uuidModels: Set<string>;

    beforeAll(() => {
      schema = readFileIfExists(SCHEMA_PATH) || '';

      // Parse model names and their ID types from schema
      cuidModels = new Set<string>();
      uuidModels = new Set<string>();

      const modelBlocks = schema.split(/^model /gm).slice(1);
      for (const block of modelBlocks) {
        const modelName = block.match(/^(\w+)/)?.[1];
        if (!modelName) continue;

        // Look at just the first few lines for the id field
        const idLine = block.split('\n').find((l) => l.includes('@id'));
        if (!idLine) continue;

        if (idLine.includes('cuid()')) {
          cuidModels.add(modelName);
        } else if (idLine.includes('uuid()')) {
          uuidModels.add(modelName);
        }
      }
    });

    it('should have parsed schema models', () => {
      expect(cuidModels.size + uuidModels.size).toBeGreaterThan(0);
    });

    // Map controller files to their primary model
    const controllerModelPairs: Array<{ controller: string; model: string }> = [
      { controller: 'content/content.controller.ts', model: 'Content' },
      { controller: 'playlists/playlists.controller.ts', model: 'Playlist' },
      { controller: 'schedules/schedules.controller.ts', model: 'Schedule' },
      { controller: 'template-library/template-library.controller.ts', model: 'Template' },
      { controller: 'notifications/notifications.controller.ts', model: 'Notification' },
      { controller: 'display-groups/display-groups.controller.ts', model: 'DisplayGroup' },
      { controller: 'folders/folders.controller.ts', model: 'ContentFolder' },
      { controller: 'api-keys/api-keys.controller.ts', model: 'ApiKey' },
      { controller: 'content/controllers/widgets.controller.ts', model: 'Content' },
      { controller: 'content/controllers/layouts.controller.ts', model: 'Content' },
      { controller: 'content/controllers/templates.controller.ts', model: 'Content' },
    ];

    it.each(controllerModelPairs)(
      '$controller should NOT use ParseUUIDPipe for CUID model $model',
      ({ controller, model }) => {
        const filePath = path.join(MODULES_DIR, controller);
        const content = readFileIfExists(filePath);
        if (!content) return; // File doesn't exist — skip

        // Only check CUID models. UUID models (User, Org, Display) correctly use ParseUUIDPipe.
        if (uuidModels.has(model)) return;

        const usesParseUUID = content.includes('ParseUUIDPipe');
        expect(usesParseUUID).toBe(false);
      },
    );

    it('users.controller should use ParseUUIDPipe (User model uses UUID)', () => {
      const content = readFileIfExists(path.join(MODULES_DIR, 'users/users.controller.ts'));
      if (!content) return;
      expect(content).toContain('ParseUUIDPipe');
    });

    it('organizations.controller should use ParseUUIDPipe (Organization model uses UUID)', () => {
      const content = readFileIfExists(path.join(MODULES_DIR, 'organizations/organizations.controller.ts'));
      if (!content) return;
      expect(content).toContain('ParseUUIDPipe');
    });
  });

  // -----------------------------------------------------------------------
  // BUG: Endpoints returning 400 for valid query params (DTO whitelist bug)
  // Root cause: forbidNonWhitelisted + PaginationDto missing limit/offset
  // -----------------------------------------------------------------------
  describe('DTO whitelist — list endpoints accept pagination', () => {
    // DTOs that are used for list/query operations should include pagination
    const dtoFiles = [
      'content/dto/query-content.dto.ts',
      'notifications/dto/query-notifications.dto.ts',
    ];

    it.each(dtoFiles)('%s should accept limit and offset', (dtoPath) => {
      const content = readFileIfExists(path.join(MODULES_DIR, dtoPath));
      if (!content) return; // File may not exist

      // Check for pagination fields (limit/offset or page/pageSize or extends PaginationDto)
      const hasPagination =
        content.includes('limit') ||
        content.includes('offset') ||
        content.includes('page') ||
        content.includes('PaginationDto') ||
        content.includes('take') ||
        content.includes('skip');

      expect(hasPagination).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // BUG: Controller registration order — :id route shadowing static routes
  // Root cause: @Get(':id') declared before @Get('widgets') in same controller
  // -----------------------------------------------------------------------
  describe('Controller route shadowing', () => {
    it('content module should register static-route controllers before parameterized-route controller', () => {
      const modulePath = path.join(MODULES_DIR, 'content/content.module.ts');
      const content = readFileIfExists(modulePath);
      if (!content) return;

      // The content module should list WidgetsController, LayoutsController, TemplatesController
      // BEFORE ContentController in the controllers array, because ContentController has @Get(':id')
      const controllersMatch = content.match(/controllers:\s*\[([\s\S]*?)\]/);
      if (!controllersMatch) return;

      const controllersBlock = controllersMatch[1];
      const controllerNames = controllersBlock
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const contentControllerIdx = controllerNames.findIndex((c) =>
        c === 'ContentController',
      );
      const widgetsIdx = controllerNames.findIndex((c) => c.includes('Widget'));
      const layoutsIdx = controllerNames.findIndex((c) => c.includes('Layout'));

      // Static-route controllers must come before the parameterized one
      if (widgetsIdx >= 0 && contentControllerIdx >= 0) {
        expect(widgetsIdx).toBeLessThan(contentControllerIdx);
      }
      if (layoutsIdx >= 0 && contentControllerIdx >= 0) {
        expect(layoutsIdx).toBeLessThan(contentControllerIdx);
      }
    });
  });

  // -----------------------------------------------------------------------
  // BUG: Organization data isolation — queries missing organizationId
  // Check: service files should include organizationId in data queries
  // -----------------------------------------------------------------------
  describe('Organization isolation', () => {
    const servicesToCheck = [
      'content/content.service.ts',
      'playlists/playlists.service.ts',
      'schedules/schedules.service.ts',
      'displays/displays.service.ts',
      'notifications/notifications.service.ts',
    ];

    it.each(servicesToCheck)('%s should reference organizationId in queries', (servicePath) => {
      const content = readFileIfExists(path.join(MODULES_DIR, servicePath));
      if (!content) return;

      // Service should reference organizationId somewhere (in where clauses)
      expect(content).toContain('organizationId');
    });
  });

  // -----------------------------------------------------------------------
  // BUG: Template thumbnails 404 on production
  // Ensure seed templates define thumbnail paths
  // -----------------------------------------------------------------------
  describe('Template seed integrity', () => {
    it('seed script should define thumbnailUrl for templates', () => {
      const seedDir = path.join(__dirname, '..', '..', '..', '..', 'templates', 'seed');
      const seedScript = readFileIfExists(path.join(seedDir, 'seed-all-templates.ts'));
      if (!seedScript) return;

      // The seed script should reference thumbnail paths
      expect(
        seedScript.includes('thumbnail') || seedScript.includes('Thumbnail'),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Guard: Global validation pipe must use whitelist: true
  // -----------------------------------------------------------------------
  describe('Global validation pipe config', () => {
    it('main.ts should use whitelist: true on ValidationPipe', () => {
      const mainTs = readFileIfExists(path.join(__dirname, '..', '..', 'main.ts'));
      if (!mainTs) return;

      expect(mainTs).toContain('whitelist: true');
    });

    it('main.ts should use transform: true on ValidationPipe', () => {
      const mainTs = readFileIfExists(path.join(__dirname, '..', '..', 'main.ts'));
      if (!mainTs) return;

      expect(mainTs).toContain('transform: true');
    });
  });
});
