import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPES } from '../decorators/require-scopes.decorator';

/**
 * Enforces @RequireScopes for API-key principals.
 *
 * The eight scopes offered in the API-keys UI previously gated nothing at all —
 * they were stored on the key and read by no code path. This is what makes them
 * authorization rather than decoration.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Not an API-key principal: a human session, governed by RolesGuard.
    if (!user || user.authType !== 'api-key') return true;

    const held: string[] = Array.isArray(user.apiKeyScopes) ? user.apiKeyScopes : [];

    /**
     * `read:all` satisfies any `read:*` requirement.
     *
     * This is a documented superset rule, not leniency. `read:all` is the
     * DEFAULT selection in the key-creation UI and the fallback in
     * ApiKeysService.create, and it is presented to the customer as "Read
     * access to all resources". Under an exact-membership test, a key created
     * by accepting the defaults would be refused by the only endpoint that
     * accepts keys — the scope that says it grants everything would grant
     * nothing.
     *
     * Deliberately confined to reads: `read:all` never satisfies a `write:*`
     * requirement, so widening a route from read to write cannot silently
     * inherit authorization from an existing key.
     */
    const satisfies = (required_scope: string) =>
      held.includes(required_scope) ||
      (required_scope.startsWith('read:') && held.includes('read:all'));

    const missing = required.filter((scope) => !satisfies(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`API key is missing required scope(s): ${missing.join(', ')}`);
    }
    return true;
  }
}
