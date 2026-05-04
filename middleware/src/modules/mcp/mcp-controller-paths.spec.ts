import { PATH_METADATA } from '@nestjs/common/constants';
import { McpController } from './mcp.controller';
import { McpTokensAdminController } from './admin/mcp-tokens.controller';

/**
 * Regression: NestJS prepends the global prefix (`api/v1`) at bootstrap
 * (see middleware/src/main.ts). If a controller's @Controller() path
 * also includes `api/v1/`, the route resolves to `/api/v1/api/v1/...`
 * and silently 404s in production. Unit tests on the controller's
 * methods don't catch this — they don't go through routing.
 *
 * These assertions pin the path strings so a future hand-edit that
 * accidentally re-introduces the prefix fails CI before deploy.
 */
describe('MCP controller route paths (regression: no double-prefix)', () => {
  it('McpController is mounted at "mcp" — global prefix gives /api/v1/mcp', () => {
    const path = Reflect.getMetadata(PATH_METADATA, McpController);
    expect(path).toBe('mcp');
    expect(path).not.toMatch(/^api\/v1\//);
  });

  it('McpTokensAdminController is mounted at "admin/mcp-tokens" — global prefix gives /api/v1/admin/mcp-tokens', () => {
    const path = Reflect.getMetadata(PATH_METADATA, McpTokensAdminController);
    expect(path).toBe('admin/mcp-tokens');
    expect(path).not.toMatch(/^api\/v1\//);
  });
});
