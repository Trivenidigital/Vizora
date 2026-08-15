import { applyDecorators, UseGuards } from '@nestjs/common';
import { AllowApiKey } from './allow-api-key.decorator';
import { RequireScopes } from './require-scopes.decorator';
import { ScopesGuard } from '../guards/scopes.guard';

/**
 * Open a route to API-key authentication, requiring the given scopes.
 *
 * Use this rather than composing @AllowApiKey + @RequireScopes +
 * @UseGuards(ScopesGuard) by hand. Those are three independent decorators, so
 * omitting the guard leaves a route that accepts API keys and enforces NO
 * scopes — and it fails silently, because the route still works. That is the
 * same class of defect ScopesGuard exists to fix: the scopes offered in the UI
 * previously gated nothing at all.
 *
 * Scopes are authorization only. Tenancy is bound separately by the principal's
 * organizationId and must never be inferred from a scope.
 */
export const ApiKeyRoute = (...scopes: string[]) =>
  applyDecorators(AllowApiKey(), RequireScopes(...scopes), UseGuards(ScopesGuard));
