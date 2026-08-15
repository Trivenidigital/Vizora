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

  /**
   * One-shot latch for the "kill switch set to a value that does nothing" warn.
   *
   * The switch's whole purpose is emergency restoration under time pressure, so
   * an operator who types `API_KEY_ENTITLEMENT_GATE_ENABLED=0` and sees nothing
   * change has no signal to correct with. Warned once per process rather than
   * per request — this is a config observation, not a per-request event, and at
   * request rate it would drown the denial lines that matter.
   *
   * Only the WARN is latched. The gate decision itself stays call-time.
   */
  private killSwitchIgnoredValueWarned = false;

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
     * Kill switch: enabled by DEFAULT; only the exact string 'false' disables
     * it (see `killSwitchIgnoredValueWarned` below — any other value leaves the
     * gate ON and is warned about once).
     *
     * It exists because `subscriptionTier` is NOT reliably written on purchase.
     * On the Razorpay path it is never written AT ALL: `handleCheckoutCompleted`
     * early-returns for `provider !== 'stripe'` (billing.service.ts:1027),
     * `handleSubscriptionUpdated` writes only `subscriptionStatus` (:845-850),
     * and `razorpaySubscriptionId` is never assigned anywhere — only read or
     * nulled — which also makes the plan-change write at :327 throw. So a
     * paying Razorpay customer stays on tier 'free' and this gate denies them.
     * Until that gap closes (backlog B3), granting API access requires a
     * super-admin tier edit (`PATCH /api/v1/admin/organizations/:id`) or this
     * kill switch.
     *
     * Read at CALL time, not module load, so an env change takes effect on
     * reload — use the guarded procedure, `npx tsx scripts/ops/pm2-guard.ts
     * app-reload --env production`, not a bare `pm2 reload --update-env`.
     */
    const gateSetting = process.env.API_KEY_ENTITLEMENT_GATE_ENABLED;
    const gateDisabled = gateSetting === 'false';

    // An empty value is "left at the default", not a typo — `.env.example`
    // ships the key with no value, and dotenv loads that as ''.
    const gateSettingProvided = gateSetting !== undefined && gateSetting !== '';

    if (gateSettingProvided && !gateDisabled && !this.killSwitchIgnoredValueWarned) {
      this.killSwitchIgnoredValueWarned = true;
      this.logger.warn(
        `API_KEY_ENTITLEMENT_GATE_ENABLED is set to "${gateSetting}", which is IGNORED — ` +
          "the entitlement gate remains ACTIVE. Only the exact string 'false' disables it.",
      );
    }

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
