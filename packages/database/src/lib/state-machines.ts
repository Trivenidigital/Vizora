/**
 * Declared state machines — one vocabulary per lifecycle column.
 *
 * No status column in this schema is a database enum: each is a free `String`,
 * and before this file the list of legal values was retyped at every consumer.
 * The copies drifted (see docs/plans/2026-11-23-state-machine-definitions.md).
 * This module is the single declared definition; the copies are pinned to it by
 * `scripts/ops/state-machine-conformance.test.ts`, which runs in CI.
 *
 * THESE DEFINITIONS DESCRIBE THE CODE AS IT IS, NOT AS IT SHOULD BE.
 *
 * - `transitions` is DESCRIPTIVE. It records which from -> to moves the write
 *   sites can perform today, cited per machine below. Nothing enforces it at
 *   runtime. Where a write has no guard on the prior state (archive from any
 *   status, an admin PUT of any DTO value), the table says "every state -> that
 *   target", because that is what the code permits. Self-transitions (writing
 *   the value a row already holds) are never listed.
 * - `written: false` marks a value that is accepted, filtered on or displayed
 *   somewhere, but that no server path ever persists. A value a server path
 *   persists only when an operator or admin supplies it through a validated DTO
 *   still counts as written.
 *
 * Deliberately dependency-free (no imports, no Prisma): it is re-exported from
 * the package index, so it is evaluated whenever `@vizora/database` is loaded,
 * and it must never be able to throw at import time. Validation of the tables
 * lives in the conformance test, not here.
 */

export type StateTone = 'positive' | 'neutral' | 'info' | 'warning' | 'danger';

export interface StateDef {
  label: string;
  description: string;
  tone: StateTone;
  /** false = accepted/displayed somewhere but NO server path writes it */
  written: boolean;
}

export interface StateMachine<S extends string> {
  name: string;
  entity: string;
  field: string;
  states: Readonly<Record<S, StateDef>>;
  /** DESCRIPTIVE: what write sites do today. Not enforced anywhere. */
  transitions: Readonly<Record<S, readonly S[]>>;
  values: readonly S[];
  is(v: unknown): v is S;
  canTransition(from: S, to: S): boolean;
}

export function defineStateMachine<S extends string>(def: {
  name: string;
  entity: string;
  field: string;
  states: Record<S, StateDef>;
  transitions: Record<S, readonly S[]>;
}): StateMachine<S> {
  const values = Object.freeze(Object.keys(def.states) as S[]);
  const valueSet = new Set<string>(values);
  const states = Object.freeze({ ...def.states });
  const transitions = Object.freeze({ ...def.transitions });
  return Object.freeze({
    name: def.name,
    entity: def.entity,
    field: def.field,
    states,
    transitions,
    values,
    is(v: unknown): v is S {
      return typeof v === 'string' && valueSet.has(v);
    },
    canTransition(from: S, to: S): boolean {
      const targets = transitions[from];
      return Array.isArray(targets) && targets.includes(to);
    },
  });
}

// ─── Display.status ─────────────────────────────────────────────────────────

export type DisplayStatus = 'online' | 'offline' | 'pairing' | 'error';

/**
 * Write sites (every one of them is unguarded on the prior status unless noted,
 * which is why every state reaches every other):
 *
 * - middleware displays.service.ts `update` — operator PATCH; `UpdateDisplayDto`
 *   (PartialType of `CreateDisplayDto`) accepts online | offline | error and the
 *   value is spread into the write with no prior-status check. This is the ONLY
 *   path that writes `error`.
 * - displays.service.ts `updateHeartbeat` — any (non-disabled) -> online.
 * - displays.service.ts `detectOfflineDevices` — online -> offline (guarded).
 * - displays.service.ts `resetStalePairingDevices` — pairing -> offline (guarded).
 * - pairing.service.ts `completePairing` (existing-display branch) and
 *   `rebindPairingSession` — any -> pairing.
 * - realtime device.gateway.ts `handleConnection` and the heartbeat handler —
 *   any -> online; `handleDisconnect` — any -> offline (`updateMany` on id only).
 *
 * Initial values: schema default `offline` (`create`, or a DTO-supplied value);
 * a newly paired display is created as `pairing`.
 */
export const displayStatus = defineStateMachine<DisplayStatus>({
  name: 'displayStatus',
  entity: 'Display',
  field: 'status',
  states: {
    online: {
      label: 'Online',
      description: 'The screen was recently connected or heartbeating; this is a recent observation, not a live fact.',
      tone: 'positive',
      written: true,
    },
    offline: {
      label: 'Offline',
      description: 'The screen is not connected; it may still be playing cached content.',
      tone: 'warning',
      written: true,
    },
    pairing: {
      label: 'Pairing',
      description: 'The screen has been paired but has not yet made its first connection.',
      tone: 'info',
      written: true,
    },
    error: {
      label: 'Error',
      description: 'An operator marked the screen as being in error; no automatic path sets this.',
      tone: 'danger',
      written: true,
    },
  },
  transitions: {
    online: ['offline', 'pairing', 'error'],
    offline: ['online', 'pairing', 'error'],
    pairing: ['online', 'offline', 'error'],
    error: ['online', 'offline', 'pairing'],
  },
});

// ─── Organization.subscriptionStatus ────────────────────────────────────────

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'publish_locked'
  | 'suspended'
  | 'canceled';

/**
 * Write sites (middleware):
 *
 * - billing/entitlement.service.ts `beginPastDue` — trial | active -> past_due
 *   (guarded), called from billing.service `applyTierFromPlan` and
 *   `handlePaymentFailed`.
 * - entitlement.service.ts `advanceLadder` rungs — past_due -> publish_locked,
 *   publish_locked -> suspended, suspended -> canceled (each guarded on fromStatus).
 * - entitlement.service.ts `recover` — UNGUARDED any -> active; its callers
 *   (`handlePaymentSucceeded`, `handleCheckoutCompleted`) only call it for a
 *   dunning status.
 * - billing.service.ts `applyTierFromPlan` — terminal mapped status: any ->
 *   canceled; `trial`/`active` written only when the org is NOT on a dunning rung,
 *   so trial | active | canceled -> trial | active.
 * - billing.service.ts `handleCheckoutCompleted` — any -> active (writeEntitlement
 *   orders on billingEventAt only, not on status).
 * - billing.service.ts `reactivateSubscription` — any -> active (Stripe only;
 *   no local-status guard).
 * - billing.service.ts `cancelSubscription`, `handleSubscriptionCanceled` — any
 *   -> canceled.
 * - billing/billing-lifecycle.service.ts `expireTrials` — trial -> canceled.
 *   (docs/design/entitlement-state-machine.md says trial expiry follows the
 *   ladder; the code cancels the trial directly. This table follows the code.)
 * - admin/services/organizations-admin.service.ts `update` — admin PUT; the DTO
 *   accepts trial | active | past_due | canceled | suspended, unguarded, so any
 *   -> each of those. It cannot write publish_locked.
 * - organizations-admin.service.ts `extendTrial` — any -> trial.
 * - organizations-admin.service.ts `suspend` — any but suspended -> suspended.
 * - organizations-admin.service.ts `unsuspend` — suspended -> the status saved at
 *   suspend time (default active), i.e. any non-suspended state. This is the only
 *   way back into publish_locked other than the ladder.
 *
 * Initial value: `trial` (auth.service registration; schema default).
 */
export const subscriptionStatus = defineStateMachine<SubscriptionStatus>({
  name: 'subscriptionStatus',
  entity: 'Organization',
  field: 'subscriptionStatus',
  states: {
    trial: {
      label: 'Trial',
      description: 'The organization is on its free trial and has not paid yet.',
      tone: 'info',
      written: true,
    },
    active: {
      label: 'Active',
      description: 'The subscription is in good standing.',
      tone: 'positive',
      written: true,
    },
    past_due: {
      label: 'Past due',
      description: 'A payment failed; everything still works while the grace period runs.',
      tone: 'warning',
      written: true,
    },
    publish_locked: {
      label: 'Publish locked',
      description: 'Payment is overdue; screens keep playing but new content cannot be published.',
      tone: 'warning',
      written: true,
    },
    suspended: {
      label: 'Suspended',
      description: 'The organization is suspended; screens show a holding screen until it is resolved.',
      tone: 'danger',
      written: true,
    },
    canceled: {
      label: 'Canceled',
      description: 'The subscription has ended and the organization is on the free tier.',
      tone: 'neutral',
      written: true,
    },
  },
  transitions: {
    trial: ['active', 'past_due', 'suspended', 'canceled'],
    active: ['trial', 'past_due', 'suspended', 'canceled'],
    past_due: ['trial', 'active', 'publish_locked', 'suspended', 'canceled'],
    publish_locked: ['trial', 'active', 'past_due', 'suspended', 'canceled'],
    suspended: ['trial', 'active', 'past_due', 'publish_locked', 'canceled'],
    canceled: ['trial', 'active', 'past_due', 'suspended'],
  },
});

// ─── Content.status ─────────────────────────────────────────────────────────

export type ContentStatus =
  | 'active'
  | 'archived'
  | 'expired'
  | 'flagged'
  | 'rejected'
  | 'pending_approval'
  | 'draft'
  | 'ready'
  | 'processing'
  | 'error';

/**
 * Write sites (middleware content/content.service.ts unless noted):
 *
 * - `archive`, `bulkArchive`, the archive branch of `bulkDelete`, and
 *   template-library.service.ts `deleteTemplate` — UNGUARDED any -> archived.
 * - `restore`, `bulkRestore` — UNGUARDED any -> active.
 * - `checkExpiredContent` (`expireDueContent`) — active -> expired.
 * - `flagContent` — any except flagged | archived | rejected -> flagged; the
 *   prior status is saved in metadata.moderation.previousStatus.
 * - `reviewContent` approve — flagged -> that saved previous status (default
 *   active), i.e. any state `flagContent` admits; reject — flagged -> rejected.
 * - `submitForApproval` — draft -> pending_approval (guarded). Unreachable in
 *   practice: nothing writes `draft`.
 * - `approveContent` — pending_approval -> active; `rejectFromApproval` —
 *   pending_approval -> rejected.
 *
 * Content create/update DTOs carry no `status`, so none of `draft`, `ready`,
 * `processing` or `error` is ever persisted; they survive only as filter values
 * (`CONTENT_LIST_STATUSES`) and web display cases. Transitions out of them are
 * listed where a guard would admit them, which is what the write sites permit,
 * even though no row can be in those states today.
 *
 * Initial values: schema default `active`; the backup row `replaceFile` creates
 * is born `archived`.
 */
export const contentStatus = defineStateMachine<ContentStatus>({
  name: 'contentStatus',
  entity: 'Content',
  field: 'status',
  states: {
    active: {
      label: 'Active',
      description: 'The content is available and can be delivered to screens.',
      tone: 'positive',
      written: true,
    },
    archived: {
      label: 'Archived',
      description: 'The content was archived and is no longer delivered to screens.',
      tone: 'neutral',
      written: true,
    },
    expired: {
      label: 'Expired',
      description: 'The content passed its expiry date and was removed from playlists or replaced.',
      tone: 'warning',
      written: true,
    },
    flagged: {
      label: 'Flagged',
      description: 'Someone flagged the content and it is waiting for an admin or manager to review it.',
      tone: 'warning',
      written: true,
    },
    rejected: {
      label: 'Rejected',
      description: 'A reviewer rejected the content and it was removed from playlists.',
      tone: 'danger',
      written: true,
    },
    pending_approval: {
      label: 'Pending approval',
      description: 'The content was submitted for approval and is waiting for a decision.',
      tone: 'info',
      written: true,
    },
    draft: {
      label: 'Draft',
      description: 'Not yet submitted; no server path currently creates draft content.',
      tone: 'neutral',
      written: false,
    },
    ready: {
      label: 'Ready',
      description: 'Accepted as a filter and display value only; no server path writes it.',
      tone: 'positive',
      written: false,
    },
    processing: {
      label: 'Processing',
      description: 'Accepted as a filter and display value only; no server path writes it.',
      tone: 'info',
      written: false,
    },
    error: {
      label: 'Error',
      description: 'Accepted as a filter and display value only; no server path writes it.',
      tone: 'danger',
      written: false,
    },
  },
  transitions: {
    active: ['archived', 'expired', 'flagged'],
    archived: ['active'],
    expired: ['active', 'archived', 'flagged'],
    flagged: [
      'active',
      'archived',
      'rejected',
      // reviewContent approve restores metadata.moderation.previousStatus:
      'expired',
      'pending_approval',
      'draft',
      'ready',
      'processing',
      'error',
    ],
    rejected: ['active', 'archived'],
    pending_approval: ['active', 'archived', 'flagged', 'rejected'],
    draft: ['active', 'archived', 'flagged', 'pending_approval'],
    ready: ['active', 'archived', 'flagged'],
    processing: ['active', 'archived', 'flagged'],
    error: ['active', 'archived', 'flagged'],
  },
});

// ─── SupportRequest.status / SupportRequest.priority ────────────────────────

export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

/**
 * Write sites (middleware support/support.service.ts):
 *
 * - `createRequest` — born `open`.
 * - `update` — admin PATCH; `UpdateSupportRequestDto` accepts all five values
 *   and writes them with no prior-status guard, so every state reaches every other.
 * - `addMessage` — a customer reply on a resolved | closed request -> open.
 */
export const supportRequestStatus = defineStateMachine<SupportRequestStatus>({
  name: 'supportRequestStatus',
  entity: 'SupportRequest',
  field: 'status',
  states: {
    open: {
      label: 'Open',
      description: 'The request is waiting for the support team.',
      tone: 'info',
      written: true,
    },
    in_progress: {
      label: 'In progress',
      description: 'Someone on the support team is working on the request.',
      tone: 'warning',
      written: true,
    },
    resolved: {
      label: 'Resolved',
      description: 'The support team considers the request answered; a customer reply reopens it.',
      tone: 'positive',
      written: true,
    },
    closed: {
      label: 'Closed',
      description: 'The request is finished; a customer reply reopens it.',
      tone: 'neutral',
      written: true,
    },
    wont_fix: {
      label: "Won't fix",
      description: 'The support team decided not to act on the request.',
      tone: 'neutral',
      written: true,
    },
  },
  transitions: {
    open: ['in_progress', 'resolved', 'closed', 'wont_fix'],
    in_progress: ['open', 'resolved', 'closed', 'wont_fix'],
    resolved: ['open', 'in_progress', 'closed', 'wont_fix'],
    closed: ['open', 'in_progress', 'resolved', 'wont_fix'],
    wont_fix: ['open', 'in_progress', 'resolved', 'closed'],
  },
});

export type SupportRequestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Priority is a ladder, not a lifecycle: any value may be replaced by any other.
 *
 * Write sites: support.service.ts `createRequest` (classifier result),
 * `update` (admin PATCH, all four values, unguarded) and `setRequestPriority`
 * (MCP `update_support_request_priority`, after mcp/lib/priority-mapping.ts maps
 * the wire vocabulary urgent | normal onto this ladder).
 *
 * NOT on this ladder, and recorded as known drift by the conformance test:
 * scripts/agents/support-triage.ts `maybeUpdatePriority` writes the agent-signal
 * vocabulary (urgent | high | normal | low) straight into this column.
 */
export const supportRequestPriority = defineStateMachine<SupportRequestPriority>({
  name: 'supportRequestPriority',
  entity: 'SupportRequest',
  field: 'priority',
  states: {
    critical: {
      label: 'Critical',
      description: 'Something is broken for the customer right now; admins are notified immediately.',
      tone: 'danger',
      written: true,
    },
    high: {
      label: 'High',
      description: 'Important and time-sensitive; admins are notified.',
      tone: 'warning',
      written: true,
    },
    medium: {
      label: 'Medium',
      description: 'A normal request, handled in order.',
      tone: 'neutral',
      written: true,
    },
    low: {
      label: 'Low',
      description: 'A question, idea or feedback with no urgency.',
      tone: 'neutral',
      written: true,
    },
  },
  transitions: {
    critical: ['high', 'medium', 'low'],
    high: ['critical', 'medium', 'low'],
    medium: ['critical', 'high', 'low'],
    low: ['critical', 'high', 'medium'],
  },
});

// ─── Ops incident status (logs/ops-state.json) ──────────────────────────────

export type OpsIncidentStatus = 'open' | 'resolved' | 'escalated';

/**
 * Not a database column: the status of an incident in the ops agents' shared
 * state file, `scripts/ops/lib/types.ts` `IncidentStatus`.
 *
 * Write sites:
 * - scripts/ops/lib/state.ts `recordAgentRun` upserts each agent's incidents BY
 *   ID with no guard on the stored copy's status, so whatever an agent emits for
 *   a deterministic id replaces whatever was there.
 * - state.ts `resolveNotReraised` / `resolveNotReraisedForTypes` — open |
 *   escalated -> resolved.
 * - resolved -> open / escalated: any re-raise of the same id (ids are
 *   deterministic, `makeIncidentId`); fleet-manager.ts raises
 *   `display_offline_persistent` directly as escalated.
 * - open -> escalated: health-guardian.ts after exhausted restarts;
 *   fleet-manager.ts persistent-offline escalation.
 */
export const opsIncidentStatus = defineStateMachine<OpsIncidentStatus>({
  name: 'opsIncidentStatus',
  entity: 'Incident (logs/ops-state.json)',
  field: 'status',
  states: {
    open: {
      label: 'Open',
      description: 'An ops agent detected the problem and it has not cleared yet.',
      tone: 'danger',
      written: true,
    },
    resolved: {
      label: 'Resolved',
      description: 'The agent that raised the problem saw it clear on a later run.',
      tone: 'positive',
      written: true,
    },
    escalated: {
      label: 'Escalated',
      description: 'Automatic remediation gave up; an operator needs to look.',
      tone: 'warning',
      written: true,
    },
  },
  transitions: {
    open: ['resolved', 'escalated'],
    resolved: ['open', 'escalated'],
    // UNVERIFIED: escalated -> open. recordAgentRun permits it, and the two agents
    // that raise `escalated` (health-guardian service-down path, fleet-manager
    // display_offline_persistent) visibly guard against walking it back; I did
    // not audit every incident type in those two agents to prove no path does.
    escalated: ['resolved', 'open'],
  },
});

/** Every declared machine, for tooling that wants to iterate them. */
export const STATE_MACHINES = [
  displayStatus,
  subscriptionStatus,
  contentStatus,
  supportRequestStatus,
  supportRequestPriority,
  opsIncidentStatus,
] as const;
