import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES = 'requiredScopes';

/**
 * Scopes an API-key principal must hold to reach this route.
 *
 * Only constrains API-key principals. A JWT session is a human with a role, and
 * roles are enforced separately by RolesGuard; applying key scopes to sessions
 * would silently lock out the dashboard.
 *
 * Scope checks are authorization, never tenancy — they must not be treated as a
 * substitute for the organizationId binding on the principal.
 */
export const RequireScopes = (...scopes: string[]) => SetMetadata(REQUIRED_SCOPES, scopes);
