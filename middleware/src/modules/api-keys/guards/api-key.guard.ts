import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';
import { hasApiAccess } from '../../billing/constants/plans';

/**
 * The principal an API key authenticates AS.
 *
 * Deliberately an explicit machine identity rather than an imitation of
 * `AuthenticatedUser` (auth/strategies/jwt.strategy.ts). Anything shaped like a
 * human user invites downstream code to treat it as one, and three properties
 * of THIS codebase make specific fields dangerous:
 *
 * - NO `id`. SuperAdminGuard (admin/guards/super-admin.guard.ts:9-19) reads
 *   `request.user?.id` and then RE-QUERIES the database for that user's
 *   isSuperAdmin — it never trusts the flag on the principal. `ApiKey.createdById`
 *   is a real user FK, so giving the principal the creator's id "for nicer audit
 *   logs" would let SuperAdminGuard look that human up and hand an API key
 *   super-admin. Absent `id` makes it throw "Authentication required" instead.
 *
 * - `role: undefined`. RolesGuard (auth/guards/roles.guard.ts:24) compares with
 *   strict `===`, so undefined never matches 'admin'/'manager'/'viewer' and a
 *   @Roles route denies by construction rather than by luck.
 *
 * - `isSuperAdmin: false` present and falsy, not omitted. A truthy value
 *   short-circuits tenant derivation to a global bypass, so this is stated
 *   explicitly rather than left to absence.
 *
 * `organizationId` is the whole tenant boundary for anything this principal can
 * reach: reads are passed through by tenant-guard.ts:155 and @CurrentUser is a
 * bare optional-chain read, so an absent value yields `undefined` and Prisma
 * treats that as "no filter" — an unscoped, HTTP 200 cross-tenant read.
 */
export interface ApiKeyPrincipal {
  organizationId: string;
  authType: 'api-key';
  apiKeyId: string;
  apiKeyScopes: string[];
  isSuperAdmin: false;
  role: undefined;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) return false;

    const keyRecord = await this.apiKeysService.validateKey(apiKey);
    if (!keyRecord) return false;

    /**
     * B2 entitlement gate — a stored key is not a standing licence.
     *
     * The credential stays valid forever; what is checked here is whether the
     * org's CURRENT subscription includes API access. Downgrade therefore
     * denies use without revoking anything, and a re-upgrade restores the same
     * key. Auto-revoke would have destroyed a customer's integration secret on
     * a billing event they might reverse the next day.
     *
     * This runs BEFORE `request.user` is bound below, so a denied request never
     * acquires a tenant-scoped principal at all.
     *
     * THROWING is load-bearing, not stylistic. Returning `false` would be
     * converted by JwtAuthGuard's api-key branch (auth/guards/jwt-auth.guard.ts:81-88)
     * into `401 Invalid API key` — the wrong signal entirely for a perfectly
     * valid credential whose plan lacks the entitlement, and one that sends
     * integrators hunting a key-rotation bug. A thrown ForbiddenException
     * propagates through that branch untouched and renders 403, matching the
     * ScopesGuard precedent for "authenticated but not permitted".
     *
     * Kill switch: enabled by DEFAULT; only the explicit string 'false'
     * disables it. It exists because `subscriptionTier` can go stale —
     * `BillingService.handleSubscriptionUpdated` never writes that column, so
     * an out-of-band Razorpay upgrade can leave a paying customer recorded at
     * their old tier, and this gate would then deny them. The lever lets ops
     * restore access in one env edit while the tier is corrected. Read at CALL
     * time, not module load, so a `pm2 reload --update-env` takes effect and
     * tests can toggle it.
     */
    const gateDisabled = process.env.API_KEY_ENTITLEMENT_GATE_ENABLED === 'false';
    if (!gateDisabled) {
      // A missing organization relation should be impossible (FK-backed), so
      // treat it as NOT entitled rather than as "nothing to check".
      const org = keyRecord.organization;
      if (!hasApiAccess(org?.subscriptionTier, org?.subscriptionStatus)) {
        // §12b: a downgrade silently killing a live customer integration must
        // be traceable. Ids and plan tokens only — never key material.
        this.logger.warn(
          `api_key_entitlement_denied org=${keyRecord.organizationId} keyId=${keyRecord.id} ` +
            `tier=${org?.subscriptionTier ?? 'unknown'} status=${org?.subscriptionStatus ?? 'unknown'}`,
        );
        throw new ForbiddenException(
          "API access is not included in your organization's current plan",
        );
      }
    }

    /**
     * Bind the principal to `request.user`, which is the contract every
     * org-scoped controller already consumes via @CurrentUser('organizationId').
     * Setting only the previous `request.organizationId` field bound nothing:
     * nothing in the request path reads it, so a guarded endpoint would have
     * seen @CurrentUser() undefined AND deriveTenantContext would have returned
     * `{ organizationId: null, bypass: true }` — two independent cross-tenant
     * vectors from one missing binding.
     */
    const principal: ApiKeyPrincipal = {
      organizationId: keyRecord.organizationId,
      authType: 'api-key',
      apiKeyId: keyRecord.id,
      apiKeyScopes: keyRecord.scopes,
      isSuperAdmin: false,
      role: undefined,
    };
    request.user = principal;

    // Retained for any caller reading these directly; `request.user` above is
    // the binding that actually scopes tenancy.
    request.organizationId = keyRecord.organizationId;
    request.apiKeyScopes = keyRecord.scopes;
    request.apiKeyId = keyRecord.id;

    // Update last used timestamp — intentionally fire-and-forget so a
    // transient DB blip doesn't fail an otherwise-valid auth, but logged
    // at warn so the failure is visible. R10 api-keys scout: previous
    // empty .catch() hid DB degradation and left the audit trail with
    // silent gaps. The request still succeeds (key was valid); ops sees
    // the warn and knows the timestamp didn't update.
    this.apiKeysService.updateLastUsed(keyRecord.id).catch((err) => {
      this.logger.warn(
        `Failed to update lastUsedAt for api-key ${keyRecord.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    });

    return true;
  }
}
