import { PATH_METADATA } from '@nestjs/common/constants';
import { McpController } from './mcp.controller';
import { McpTokensAdminController } from './admin/mcp-tokens.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

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

  // Regression: AuthModule registers JwtAuthGuard as APP_GUARD globally.
  // Without @Public() on McpController, the global guard intercepts the
  // request, tries to parse `mcp_<token>` as a user JWT, fails, and
  // throws a generic 401 — McpAuthGuard never runs and the precise
  // "Invalid or expired MCP token" message never reaches the wire.
  it('McpController is marked @Public() so the global JwtAuthGuard skips it (McpAuthGuard handles bearer auth instead)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, McpController);
    expect(isPublic).toBe(true);
  });

  // The admin token-issuance endpoints use REAL user JWTs (super-admin
  // session) — those routes MUST NOT be marked public.
  it('McpTokensAdminController is NOT marked @Public() — super-admin endpoints require user-session JWT', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, McpTokensAdminController);
    expect(isPublic).toBeFalsy();
  });
});
