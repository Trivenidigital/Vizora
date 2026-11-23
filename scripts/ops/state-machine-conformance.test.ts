/**
 * Every known copy of a declared status vocabulary is pinned to its definition.
 *
 * The definitions live in packages/database/src/lib/state-machines.ts. Before it
 * existed each vocabulary was retyped at every consumer, and the copies drifted
 * into real defects: fleet-manager PATCHes a display status the DTO rejects,
 * support-triage writes priorities that are off the ladder, the admin UI waits
 * for a subscription status the backend never stores. See
 * docs/plans/2026-11-23-state-machine-definitions.md.
 *
 * Three rules keep this suite from passing vacuously:
 *
 *   1. Every extractor is ANCHORED to one named construct and must match it
 *      exactly once. A missing file, a missing anchor, an ambiguous anchor or a
 *      zero-value extraction FAILS — it never skips.
 *   2. A control feeds a deliberately wrong list through the same comparison
 *      and asserts it is reported.
 *   3. Existing disagreements are listed in KNOWN_DRIFT with a reason, so the
 *      suite is green today without changing production code. An entry that no
 *      longer reproduces FAILS, so the list can only shrink.
 *
 * Imported by relative path, not `@vizora/database`: the package index also
 * pulls in the generated Prisma client.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STATE_MACHINES,
  defineStateMachine,
  type StateMachine,
} from '../../packages/database/src/lib/state-machines.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

type MachineName = (typeof STATE_MACHINES)[number]['name'];

/**
 * How a copy must relate to its machine:
 *   equal  — the copy lists exactly the machine's values
 *   subset — every value in the copy is a machine value (the copy may be narrower)
 *   covers — the copy has an entry for every machine value (and may hold
 *            unrelated keys too, e.g. a badge map shared with invoice statuses)
 */
type Relation = 'equal' | 'subset' | 'covers';

interface ManifestEntry {
  /** Unique, human-readable name of this copy. KNOWN_DRIFT refers to it. */
  copy: string;
  machine: MachineName;
  file: string;
  extract: (src: string) => string[];
  relation: Relation;
  /** Compare against only the `written: true` states (for "what is stored" docs). */
  against?: 'all' | 'written';
}

interface Drift {
  value: string;
  kind: 'extra' | 'missing';
}

interface KnownDrift extends Drift {
  copy: string;
  file: string;
  machine: MachineName;
  reason: string;
}

// ─── Anchored extraction helpers ────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exactly one match of `re` in `src`, or throw naming what was looked for. */
function only(src: string, re: RegExp, what: string): RegExpMatchArray {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const matches = [...src.matchAll(new RegExp(re.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`anchor ${what}: expected exactly 1 match, found ${matches.length}`);
  }
  return matches[0];
}

/** Every quoted string literal in a fragment. */
function literals(fragment: string): string[] {
  return [...fragment.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)].map((m) => m[1] ?? m[2]);
}

/** Text from the unique `start` match up to the next occurrence of `end`. */
function slice(src: string, start: RegExp, end: string, what: string): string {
  const m = only(src, start, what);
  const from = m.index ?? 0;
  const to = src.indexOf(end, from + m[0].length);
  if (to < 0) throw new Error(`anchor ${what}: no terminating ${JSON.stringify(end)}`);
  return src.slice(from + m[0].length, to);
}

/** A TS union written after `anchor` up to the next `;` or `{`. */
const unionAfter = (anchor: string) => (src: string) =>
  literals(only(src, new RegExp(`${anchor}([^;{]+)[;{]`), anchor)[1]);

/** The literal list of an `@IsIn([...])` / `@IsEnum([...])` decorating `prop`. */
const decoratorList = (prop: string) => (src: string) =>
  literals(
    only(
      src,
      new RegExp(`@(?:IsIn|IsEnum)\\(\\[([^\\]]*)\\]\\)(?:\\s*@\\w+\\([^)]*\\))*\\s*${prop}[?!]?:`),
      `@IsIn/@IsEnum on ${prop}`,
    )[1],
  );

/** The literal list of `prefix z.enum([...])`. */
const zodEnum = (prefix: string) => (src: string) =>
  literals(only(src, new RegExp(`${escapeRe(prefix)}\\s*z\\.enum\\(\\[([^\\]]*)\\]\\)`), `${prefix} z.enum`)[1]);

/** The elements of `NAME = [...]` or `NAME = new Set<string>([...])`. */
const arrayConst = (name: string) => (src: string) =>
  literals(
    only(
      src,
      new RegExp(`\\b(?:const|readonly) ${name}(?::[^=\\n]*)?\\s*=\\s*(?:new Set<string>\\()?\\[([^\\]]*)\\]`),
      name,
    )[1],
  );

/** The keys of the object literal assigned to `const NAME`. */
const objectKeys = (name: string) => (src: string) => {
  const body = only(src, new RegExp(`const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`), `const ${name}`)[1];
  return [...body.matchAll(/^\s*['"]?([a-z_]+)['"]?\s*:/gm)].map((m) => m[1]);
};

/** `case '...'` labels of the switch that follows `start`, up to `default:`. */
const switchCases = (start: string) => (src: string) =>
  [...slice(src, new RegExp(escapeRe(start)), 'default:', start).matchAll(/case '([^']+)':/g)].map((m) => m[1]);

/** `<option value="...">` values of the `<select value={expr}>`, minus sentinels. */
const selectOptions = (expr: string, sentinels: string[]) => (src: string) =>
  [...slice(src, new RegExp(`value=\\{${escapeRe(expr)}\\}`), '</select>', `select value={${expr}}`).matchAll(
    /<option value="([^"]*)"/g,
  )]
    .map((m) => m[1])
    .filter((v) => !sentinels.includes(v));

/** `{ value: '...' }` entries of `const NAME = [...]`, minus sentinels. */
const optionObjects = (name: string, sentinels: string[]) => (src: string) =>
  [...only(src, new RegExp(`const ${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\];`), `const ${name}`)[1].matchAll(
    /value: '([^']*)'/g,
  )]
    .map((m) => m[1])
    .filter((v) => !sentinels.includes(v));

/** `return '...'` literals inside `function NAME(` up to its closing `\n}`. */
const functionReturns = (name: string) => (src: string) =>
  [...slice(src, new RegExp(`function ${name}\\(`), '\n}', `function ${name}`).matchAll(/return '([^']+)'/g)].map(
    (m) => m[1],
  );

/** The `// a, b, c` trailing comment on `field String` inside `model NAME`. */
const schemaComment = (model: string, field: string) => (src: string) => {
  const body = only(src, new RegExp(`\\nmodel ${model} \\{([\\s\\S]*?)\\n\\}`), `model ${model}`)[1];
  const comment = only(body, new RegExp(`^\\s*${field}\\s+String[^\\n]*?//([^\\n]*)$`, 'm'), `${model}.${field}`)[1];
  return comment.split(',').map((v) => v.trim());
};

/** Every `PROP === '...'` / `PROP !== '...'` comparison in the file. */
const comparisons = (prop: string) => (src: string) =>
  [...src.matchAll(new RegExp(`${escapeRe(prop)} [!=]== '([^']+)'`, 'g'))].map((m) => m[1]);

/** A single regex capture holding a literal list. */
const captured = (re: RegExp, what: string) => (src: string) => literals(only(src, re, what)[1]);

// ─── The manifest ───────────────────────────────────────────────────────────

const SCHEMA = 'packages/database/prisma/schema.prisma';
const WEB_TYPES = 'web/src/lib/types.ts';
const SUPPORT_QUERY_DTO = 'middleware/src/modules/support/dto/support-query.dto.ts';
const SUPPORT_UPDATE_DTO = 'middleware/src/modules/support/dto/update-support-request.dto.ts';
const SUPPORT_CARD = 'web/src/app/admin/support/components/SupportRequestCard.tsx';
const SUPPORT_DETAIL = 'web/src/app/admin/support/components/SupportRequestDetail.tsx';
const SUPPORT_FILTERS = 'web/src/app/admin/support/components/SupportFilters.tsx';
const BILLING_SERVICE = 'middleware/src/modules/billing/billing.service.ts';
const ADMIN_ORGS_PAGE = 'web/src/app/admin/organizations/page-client.tsx';
const CONTENT_PAGE = 'web/src/app/dashboard/content/page-client.tsx';
const OPS_PAGE = 'web/src/app/dashboard/ops/page.tsx';

const MANIFEST: readonly ManifestEntry[] = [
  // ── displayStatus ──
  { copy: 'schema Display.status comment', machine: 'displayStatus', file: SCHEMA, extract: schemaComment('Display', 'status'), relation: 'equal', against: 'written' },
  { copy: 'CreateDisplayDto.status @IsEnum (operator-settable subset)', machine: 'displayStatus', file: 'middleware/src/modules/displays/dto/create-display.dto.ts', extract: decoratorList('status'), relation: 'subset' },
  { copy: 'DisplaysService.findAll status filter', machine: 'displayStatus', file: 'middleware/src/modules/displays/displays.service.ts', extract: captured(/filters\?: \{ status\?: ([^}]+)\}/, 'findAll filters'), relation: 'equal' },
  // The input enum carries the query-only sentinel 'all', stripped explicitly.
  { copy: 'MCP list_displays input status (minus "all")', machine: 'displayStatus', file: 'middleware/src/modules/mcp/schemas/tool-inputs.ts', extract: (src) => zodEnum('status:')(src).filter((v) => v !== 'all'), relation: 'equal' },
  { copy: 'MCP display output status', machine: 'displayStatus', file: 'middleware/src/modules/mcp/schemas/tool-outputs.ts', extract: zodEnum('status:'), relation: 'equal' },
  { copy: 'MCP displays tool status cast', machine: 'displayStatus', file: 'middleware/src/modules/mcp/tools/displays.tools.ts', extract: captured(/d\.status as ([^,\n]+)/, 'd.status as'), relation: 'equal' },
  { copy: 'realtime DeviceStatus.status', machine: 'displayStatus', file: 'realtime/src/types/index.ts', extract: captured(/interface DeviceStatus \{[^}]*?status: ([^;]+);/, 'interface DeviceStatus'), relation: 'equal' },
  { copy: 'realtime MetricsService.updateDeviceStatus param', machine: 'displayStatus', file: 'realtime/src/metrics/metrics.service.ts', extract: captured(/updateDeviceStatus\([^)]*?status:\s*([^)]+)\)/, 'updateDeviceStatus'), relation: 'subset' },
  { copy: 'web DisplayStatus', machine: 'displayStatus', file: WEB_TYPES, extract: unionAfter('export type DisplayStatus ='), relation: 'equal' },
  { copy: 'web DeviceStatusContext extra union members', machine: 'displayStatus', file: 'web/src/lib/context/DeviceStatusContext.tsx', extract: unionAfter('export type DeviceStatus = DisplayStatus \\|'), relation: 'subset' },
  { copy: 'web devices FLEET_STATUSES', machine: 'displayStatus', file: 'web/src/app/dashboard/devices/page-client.tsx', extract: arrayConst('FLEET_STATUSES'), relation: 'covers' },
  { copy: 'fleet-manager error-reset PATCH status', machine: 'displayStatus', file: 'scripts/ops/fleet-manager.ts', extract: captured(/api\.patch\(`\/displays\/\$\{display\.id\}`,\s*\{\s*status:\s*('[^']+')/, 'fleet-manager display PATCH'), relation: 'subset' },

  // ── subscriptionStatus ──
  { copy: 'UpdateOrgAdminDto.subscriptionStatus @IsIn', machine: 'subscriptionStatus', file: 'middleware/src/modules/admin/dto/organizations/update-org-admin.dto.ts', extract: decoratorList('subscriptionStatus'), relation: 'equal' },
  { copy: 'OrgFiltersDto.subscriptionStatus @IsIn', machine: 'subscriptionStatus', file: 'middleware/src/modules/admin/dto/organizations/org-filters.dto.ts', extract: decoratorList('subscriptionStatus'), relation: 'equal' },
  { copy: 'SubscriptionStatusResponse.subscriptionStatus swagger enum', machine: 'subscriptionStatus', file: 'middleware/src/modules/billing/dto/billing-response.dto.ts', extract: captured(/enum: (\[[^\]]*\]),\s*\}\)\s*subscriptionStatus: string/, 'swagger enum on subscriptionStatus'), relation: 'equal' },
  { copy: 'BillingService.mapSubscriptionStatus return type', machine: 'subscriptionStatus', file: BILLING_SERVICE, extract: captured(/private mapSubscriptionStatus\([^)]*\):([^{]+)\{/, 'mapSubscriptionStatus'), relation: 'subset' },
  { copy: 'BillingService.DUNNING_STATUSES', machine: 'subscriptionStatus', file: BILLING_SERVICE, extract: arrayConst('DUNNING_STATUSES'), relation: 'subset' },
  { copy: 'BillingService.TIER_GRANTING_STATUSES', machine: 'subscriptionStatus', file: BILLING_SERVICE, extract: arrayConst('TIER_GRANTING_STATUSES'), relation: 'subset' },
  { copy: 'BillingService.TERMINAL_STATUSES', machine: 'subscriptionStatus', file: BILLING_SERVICE, extract: arrayConst('TERMINAL_STATUSES'), relation: 'subset' },
  { copy: 'plans.ts API_BLOCKED_STATUSES', machine: 'subscriptionStatus', file: 'middleware/src/modules/billing/constants/plans.ts', extract: arrayConst('API_BLOCKED_STATUSES'), relation: 'subset' },
  { copy: 'web admin organizations status filter options', machine: 'subscriptionStatus', file: ADMIN_ORGS_PAGE, extract: selectOptions('statusFilter', ['']), relation: 'equal' },
  { copy: 'web admin organizations subscriptionStatus comparisons', machine: 'subscriptionStatus', file: ADMIN_ORGS_PAGE, extract: comparisons('subscriptionStatus'), relation: 'subset' },
  { copy: 'web admin StatusBadge statusTone keys', machine: 'subscriptionStatus', file: 'web/src/app/admin/components/StatusBadge.tsx', extract: objectKeys('statusTone'), relation: 'covers' },
  { copy: 'web billing status-badge statusConfig keys', machine: 'subscriptionStatus', file: 'web/src/app/dashboard/settings/billing/components/status-badge.tsx', extract: objectKeys('statusConfig'), relation: 'covers' },

  // ── contentStatus ──
  { copy: 'schema Content.status comment', machine: 'contentStatus', file: SCHEMA, extract: schemaComment('Content', 'status'), relation: 'equal', against: 'written' },
  { copy: 'CONTENT_LIST_STATUSES', machine: 'contentStatus', file: 'middleware/src/modules/content/content-list-query.ts', extract: arrayConst('CONTENT_LIST_STATUSES'), relation: 'equal' },
  { copy: 'web Content.status', machine: 'contentStatus', file: WEB_TYPES, extract: captured(/export interface Content \{[\s\S]*?\n {2}status:([^;]+);/, 'interface Content status'), relation: 'equal' },
  { copy: 'web content getStatusColor cases', machine: 'contentStatus', file: CONTENT_PAGE, extract: switchCases('const getStatusColor = (status: string) => {'), relation: 'equal' },
  // The content filter carries the sentinel 'all', stripped explicitly.
  { copy: 'web content status filter options (minus "all")', machine: 'contentStatus', file: CONTENT_PAGE, extract: selectOptions('filterStatus', ['all']), relation: 'equal' },

  // ── supportRequestStatus ──
  { copy: 'schema SupportRequest.status comment', machine: 'supportRequestStatus', file: SCHEMA, extract: schemaComment('SupportRequest', 'status'), relation: 'equal', against: 'written' },
  { copy: 'SupportQueryDto.status @IsIn', machine: 'supportRequestStatus', file: SUPPORT_QUERY_DTO, extract: decoratorList('status'), relation: 'equal' },
  { copy: 'UpdateSupportRequestDto.status @IsIn', machine: 'supportRequestStatus', file: SUPPORT_UPDATE_DTO, extract: decoratorList('status'), relation: 'equal' },
  { copy: 'web SupportStatus', machine: 'supportRequestStatus', file: WEB_TYPES, extract: unionAfter('export type SupportStatus ='), relation: 'equal' },
  { copy: 'web SupportRequestCard statusBadgeColors', machine: 'supportRequestStatus', file: SUPPORT_CARD, extract: objectKeys('statusBadgeColors'), relation: 'equal' },
  { copy: 'web SupportRequestCard statusLabels', machine: 'supportRequestStatus', file: SUPPORT_CARD, extract: objectKeys('statusLabels'), relation: 'equal' },
  { copy: 'web SupportRequestDetail statusColors', machine: 'supportRequestStatus', file: SUPPORT_DETAIL, extract: objectKeys('statusColors'), relation: 'equal' },
  { copy: 'web SupportRequestDetail statusLabels', machine: 'supportRequestStatus', file: SUPPORT_DETAIL, extract: objectKeys('statusLabels'), relation: 'equal' },
  { copy: 'web SupportRequestDetail status select', machine: 'supportRequestStatus', file: SUPPORT_DETAIL, extract: selectOptions('status', []), relation: 'equal' },
  { copy: 'web SupportFilters statusOptions (minus "")', machine: 'supportRequestStatus', file: SUPPORT_FILTERS, extract: optionObjects('statusOptions', ['']), relation: 'equal' },
  { copy: 'web SupportChatPanel statusColor cases', machine: 'supportRequestStatus', file: 'web/src/components/support/SupportChatPanel.tsx', extract: switchCases('function statusColor(status: string): string {'), relation: 'equal' },

  // ── supportRequestPriority ──
  { copy: 'schema SupportRequest.priority comment', machine: 'supportRequestPriority', file: SCHEMA, extract: schemaComment('SupportRequest', 'priority'), relation: 'equal', against: 'written' },
  { copy: 'SupportQueryDto.priority @IsIn', machine: 'supportRequestPriority', file: SUPPORT_QUERY_DTO, extract: decoratorList('priority'), relation: 'equal' },
  { copy: 'UpdateSupportRequestDto.priority @IsIn', machine: 'supportRequestPriority', file: SUPPORT_UPDATE_DTO, extract: decoratorList('priority'), relation: 'equal' },
  { copy: 'SupportService.setRequestPriority param', machine: 'supportRequestPriority', file: 'middleware/src/modules/support/support.service.ts', extract: captured(/async setRequestPriority\([\s\S]*?\n\s*priority: ([^,\n]+),/, 'setRequestPriority priority param'), relation: 'equal' },
  { copy: 'SupportService stats priorities', machine: 'supportRequestPriority', file: 'middleware/src/modules/support/support.service.ts', extract: arrayConst('priorities'), relation: 'equal' },
  { copy: 'MCP CanonicalPriority', machine: 'supportRequestPriority', file: 'middleware/src/modules/mcp/lib/priority-mapping.ts', extract: unionAfter('export type CanonicalPriority ='), relation: 'equal' },
  { copy: 'MCP CANONICAL_TO_MCP keys', machine: 'supportRequestPriority', file: 'middleware/src/modules/mcp/lib/priority-mapping.ts', extract: objectKeys('CANONICAL_TO_MCP'), relation: 'equal' },
  { copy: 'web SupportPriority', machine: 'supportRequestPriority', file: WEB_TYPES, extract: unionAfter('export type SupportPriority ='), relation: 'equal' },
  { copy: 'web SupportRequestCard priorityDotColors', machine: 'supportRequestPriority', file: SUPPORT_CARD, extract: objectKeys('priorityDotColors'), relation: 'equal' },
  { copy: 'web SupportRequestDetail priorityColors', machine: 'supportRequestPriority', file: SUPPORT_DETAIL, extract: objectKeys('priorityColors'), relation: 'equal' },
  { copy: 'web SupportRequestDetail priority select', machine: 'supportRequestPriority', file: SUPPORT_DETAIL, extract: selectOptions('priority', []), relation: 'equal' },
  { copy: 'web SupportFilters priorityOptions (minus "")', machine: 'supportRequestPriority', file: SUPPORT_FILTERS, extract: optionObjects('priorityOptions', ['']), relation: 'equal' },
  // `TicketPriority` (packages/database/src/types/agent-signals.ts) is a separate
  // agent-signal vocabulary that MCP maps at its boundary — not a copy of this
  // ladder. What is pinned is what support-triage WRITES to the column:
  // `maybeUpdatePriority` persists `scoreToPriority(score)` unmapped.
  { copy: 'support-triage scoreToPriority (written to SupportRequest.priority)', machine: 'supportRequestPriority', file: 'scripts/agents/support-triage.ts', extract: functionReturns('scoreToPriority'), relation: 'subset' },

  // ── opsIncidentStatus ──
  { copy: 'ops IncidentStatus type', machine: 'opsIncidentStatus', file: 'scripts/ops/lib/types.ts', extract: unionAfter('export type IncidentStatus ='), relation: 'equal' },
  { copy: 'agent-state schema IncidentStatus', machine: 'opsIncidentStatus', file: 'middleware/src/modules/agents/agent-state.schema.ts', extract: zodEnum('const IncidentStatus ='), relation: 'equal' },
  { copy: 'web ops IncidentStatus type', machine: 'opsIncidentStatus', file: OPS_PAGE, extract: unionAfter('type IncidentStatus ='), relation: 'equal' },
  { copy: 'web ops IncidentStatusBadge styles', machine: 'opsIncidentStatus', file: OPS_PAGE, extract: objectKeys('styles'), relation: 'equal' },
];

// ─── Known drift (may only shrink) ──────────────────────────────────────────

const KNOWN_DRIFT: readonly KnownDrift[] = [
  // displayStatus
  { copy: 'web DeviceStatusContext extra union members', file: 'web/src/lib/context/DeviceStatusContext.tsx', machine: 'displayStatus', value: 'idle', kind: 'extra', reason: 'Web-only derived bucket; no backend path writes "idle". Decide whether it is a derived UI state (then type it separately) or remove it.' },

  // subscriptionStatus
  { copy: 'UpdateOrgAdminDto.subscriptionStatus @IsIn', file: 'middleware/src/modules/admin/dto/organizations/update-org-admin.dto.ts', machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'Admin PUT cannot set publish_locked. Possibly intentional (the rung is ladder-owned) — needs a decision, then either keep it here with that reason or add it.' },
  { copy: 'OrgFiltersDto.subscriptionStatus @IsIn', file: 'middleware/src/modules/admin/dto/organizations/org-filters.dto.ts', machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'Admins cannot filter the organization list to orgs on the publish_locked dunning rung.' },
  { copy: 'SubscriptionStatusResponse.subscriptionStatus swagger enum', file: 'middleware/src/modules/billing/dto/billing-response.dto.ts', machine: 'subscriptionStatus', value: 'incomplete', kind: 'extra', reason: 'Documented response value that is never stored (mapSubscriptionStatus maps provider "incomplete" to past_due).' },
  { copy: 'SubscriptionStatusResponse.subscriptionStatus swagger enum', file: 'middleware/src/modules/billing/dto/billing-response.dto.ts', machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'API docs omit a status the ladder writes and the endpoint returns.' },
  { copy: 'SubscriptionStatusResponse.subscriptionStatus swagger enum', file: 'middleware/src/modules/billing/dto/billing-response.dto.ts', machine: 'subscriptionStatus', value: 'suspended', kind: 'missing', reason: 'API docs omit a status the ladder and admin suspend write and the endpoint returns.' },
  { copy: 'web admin organizations status filter options', file: ADMIN_ORGS_PAGE, machine: 'subscriptionStatus', value: 'trialing', kind: 'extra', reason: 'Filter sends the Stripe word "trialing"; the backend stores "trial", and OrgFiltersDto rejects "trialing".' },
  { copy: 'web admin organizations status filter options', file: ADMIN_ORGS_PAGE, machine: 'subscriptionStatus', value: 'trial', kind: 'missing', reason: 'No option filters to trial orgs (the option that means it sends "trialing").' },
  { copy: 'web admin organizations status filter options', file: ADMIN_ORGS_PAGE, machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'No option for the publish_locked dunning rung (the DTO does not accept it either).' },
  { copy: 'web admin organizations subscriptionStatus comparisons', file: ADMIN_ORGS_PAGE, machine: 'subscriptionStatus', value: 'trialing', kind: 'extra', reason: 'The Extend Trial action renders only for "trialing", which is never stored, so it never renders.' },
  { copy: 'web admin StatusBadge statusTone keys', file: 'web/src/app/admin/components/StatusBadge.tsx', machine: 'subscriptionStatus', value: 'trial', kind: 'missing', reason: 'Admin badge keys "trialing"; a stored "trial" falls back to the inactive tone.' },
  { copy: 'web admin StatusBadge statusTone keys', file: 'web/src/app/admin/components/StatusBadge.tsx', machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'publish_locked falls back to the inactive tone in the admin org list.' },
  { copy: 'web billing status-badge statusConfig keys', file: 'web/src/app/dashboard/settings/billing/components/status-badge.tsx', machine: 'subscriptionStatus', value: 'publish_locked', kind: 'missing', reason: 'Customer billing page renders publish_locked with the neutral fallback.' },
  { copy: 'web billing status-badge statusConfig keys', file: 'web/src/app/dashboard/settings/billing/components/status-badge.tsx', machine: 'subscriptionStatus', value: 'suspended', kind: 'missing', reason: 'Customer billing page renders suspended with the neutral fallback.' },

  // contentStatus
  { copy: 'schema Content.status comment', file: SCHEMA, machine: 'contentStatus', value: 'flagged', kind: 'missing', reason: 'Stale schema comment: flagContent writes flagged.' },
  { copy: 'schema Content.status comment', file: SCHEMA, machine: 'contentStatus', value: 'rejected', kind: 'missing', reason: 'Stale schema comment: reviewContent / rejectFromApproval write rejected.' },
  { copy: 'schema Content.status comment', file: SCHEMA, machine: 'contentStatus', value: 'pending_approval', kind: 'missing', reason: 'Stale schema comment: submitForApproval writes pending_approval.' },

  // supportRequestStatus
  { copy: 'web SupportChatPanel statusColor cases', file: 'web/src/components/support/SupportChatPanel.tsx', machine: 'supportRequestStatus', value: 'wont_fix', kind: 'missing', reason: 'Customer chat panel has no case for wont_fix; it falls through to the default style.' },

  // supportRequestPriority
  { copy: 'support-triage scoreToPriority (written to SupportRequest.priority)', file: 'scripts/agents/support-triage.ts', machine: 'supportRequestPriority', value: 'urgent', kind: 'extra', reason: 'maybeUpdatePriority writes the agent-signal word "urgent" into SupportRequest.priority without mapping it to "critical".' },
  { copy: 'support-triage scoreToPriority (written to SupportRequest.priority)', file: 'scripts/agents/support-triage.ts', machine: 'supportRequestPriority', value: 'normal', kind: 'extra', reason: 'maybeUpdatePriority writes the agent-signal word "normal" into SupportRequest.priority without mapping it to "medium".' },
];

// ─── Comparison ─────────────────────────────────────────────────────────────

function machineByName(name: MachineName): StateMachine<string> {
  const m = STATE_MACHINES.find((x) => x.name === name);
  if (!m) throw new Error(`no machine named ${name}`);
  return m as unknown as StateMachine<string>;
}

function declaredValues(machine: StateMachine<string>, against: 'all' | 'written' = 'all'): string[] {
  return machine.values.filter((v) => against === 'all' || machine.states[v].written);
}

/** Disagreements between a declared vocabulary and a copy, under a relation. */
function driftOf(declared: readonly string[], found: readonly string[], relation: Relation): Drift[] {
  const d = new Set(declared);
  const f = new Set(found);
  const drift: Drift[] = [];
  if (relation !== 'covers') {
    for (const v of f) if (!d.has(v)) drift.push({ value: v, kind: 'extra' });
  }
  if (relation !== 'subset') {
    for (const v of d) if (!f.has(v)) drift.push({ value: v, kind: 'missing' });
  }
  return drift;
}

/** Read and extract one copy. Missing file, failed anchor, or empty result all THROW. */
function extractCopy(entry: Pick<ManifestEntry, 'file' | 'extract' | 'copy'>): string[] {
  const path = join(repoRoot, entry.file);
  if (!existsSync(path)) throw new Error(`${entry.copy}: file not found: ${entry.file}`);
  const values = entry.extract(readFileSync(path, 'utf8'));
  if (values.length === 0) throw new Error(`${entry.copy}: extracted zero values from ${entry.file}`);
  return values;
}

const fmt = (d: Drift) => `${d.kind}:${d.value}`;

// ─── defineStateMachine unit tests ──────────────────────────────────────────

test('defineStateMachine derives values, is() and canTransition()', () => {
  const m = defineStateMachine<'a' | 'b' | 'c'>({
    name: 'toy',
    entity: 'Toy',
    field: 'status',
    states: {
      a: { label: 'A', description: 'A.', tone: 'neutral', written: true },
      b: { label: 'B', description: 'B.', tone: 'positive', written: true },
      c: { label: 'C', description: 'C.', tone: 'danger', written: false },
    },
    transitions: { a: ['b'], b: ['a', 'c'], c: [] },
  });
  assert.deepEqual([...m.values], ['a', 'b', 'c']);
  assert.equal(m.is('a'), true);
  assert.equal(m.is('z'), false);
  assert.equal(m.is(undefined), false);
  assert.equal(m.is(1), false);
  assert.equal(m.is('toString'), false, 'prototype keys are not states');
  assert.equal(m.canTransition('a', 'b'), true);
  assert.equal(m.canTransition('b', 'a'), true);
  assert.equal(m.canTransition('a', 'c'), false);
  assert.equal(m.canTransition('c', 'a'), false);
  assert.equal(Object.isFrozen(m), true);
  assert.equal(Object.isFrozen(m.values), true);
});

test('STATE_MACHINES holds the six declared machines with unique names', () => {
  const names = STATE_MACHINES.map((m) => m.name);
  assert.deepEqual(names, [
    'displayStatus',
    'subscriptionStatus',
    'contentStatus',
    'supportRequestStatus',
    'supportRequestPriority',
    'opsIncidentStatus',
  ]);
});

for (const machine of STATE_MACHINES as readonly StateMachine<string>[]) {
  test(`${machine.name}: transition table is well-formed`, () => {
    assert.ok(machine.values.length > 0, 'machine has states');
    assert.deepEqual(
      Object.keys(machine.transitions).sort(),
      [...machine.values].sort(),
      'every state has exactly one transitions entry',
    );
    for (const from of machine.values) {
      const targets = machine.transitions[from];
      assert.equal(new Set(targets).size, targets.length, `${from}: duplicate targets`);
      for (const to of targets) {
        assert.ok(machine.is(to), `${from} -> ${to}: target is not a declared state`);
        assert.notEqual(to, from, `${from}: self-transitions are not listed`);
        assert.equal(machine.canTransition(from, to), true);
      }
    }
  });

  test(`${machine.name}: every state has a sentence-case label, a sentence, and a tone`, () => {
    for (const v of machine.values) {
      const s = machine.states[v];
      assert.ok(s.label.length > 0, `${v}: label`);
      assert.equal(s.label[0], s.label[0].toUpperCase(), `${v}: label starts upper-case`);
      assert.equal(s.label.slice(1), s.label.slice(1).toLowerCase(), `${v}: label is sentence case`);
      assert.match(s.description, /^[A-Z].*\.$/, `${v}: description is one sentence`);
      assert.ok(['positive', 'neutral', 'info', 'warning', 'danger'].includes(s.tone), `${v}: tone`);
      assert.equal(typeof s.written, 'boolean', `${v}: written`);
    }
  });
}

// ─── Reach proof ────────────────────────────────────────────────────────────

test('control: a deliberately wrong list is reported as drift under every relation', () => {
  const declared = ['open', 'closed'];
  const wrong = ['open', 'shut'];
  assert.deepEqual(driftOf(declared, wrong, 'equal').map(fmt).sort(), ['extra:shut', 'missing:closed']);
  assert.deepEqual(driftOf(declared, wrong, 'subset').map(fmt), ['extra:shut']);
  assert.deepEqual(driftOf(declared, wrong, 'covers').map(fmt), ['missing:closed']);
  assert.deepEqual(driftOf(declared, ['open', 'closed'], 'equal'), [], 'and an exact copy is clean');
});

test('control: a real manifest copy with one value swapped is reported', () => {
  const entry = MANIFEST.find((e) => e.copy === 'web SupportStatus');
  assert.ok(entry);
  const real = extractCopy(entry);
  const tampered = real.map((v) => (v === 'wont_fix' ? 'wontfix' : v));
  const drift = driftOf(declaredValues(machineByName(entry.machine)), tampered, entry.relation).map(fmt).sort();
  assert.deepEqual(drift, ['extra:wontfix', 'missing:wont_fix']);
});

test('control: a missing file, a missing anchor, an ambiguous anchor and an empty extraction all FAIL', () => {
  assert.throws(
    () => extractCopy({ copy: 'nope', file: 'no/such/file.ts', extract: () => ['x'] }),
    /file not found/,
  );
  assert.throws(() => unionAfter('export type NoSuchType =')('export type Other = "a";'), /expected exactly 1 match, found 0/);
  assert.throws(
    () => unionAfter('export type T =')('export type T = "a";\nexport type T = "b";'),
    /expected exactly 1 match, found 2/,
  );
  assert.throws(
    () => extractCopy({ copy: 'empty', file: 'package.json', extract: () => [] }),
    /extracted zero values/,
  );
});

// ─── The ratchet ────────────────────────────────────────────────────────────

test('manifest: copy names are unique and every machine has at least two pinned copies', () => {
  const copies = MANIFEST.map((e) => e.copy);
  assert.equal(new Set(copies).size, copies.length);
  for (const m of STATE_MACHINES) {
    const n = MANIFEST.filter((e) => e.machine === m.name).length;
    assert.ok(n >= 2, `${m.name} has ${n} pinned copies`);
  }
});

test('KNOWN_DRIFT: every entry names a manifest copy with the same file and machine', () => {
  for (const k of KNOWN_DRIFT) {
    const entry = MANIFEST.find((e) => e.copy === k.copy);
    assert.ok(entry, `KNOWN_DRIFT names unknown copy ${k.copy}`);
    assert.equal(entry.file, k.file, `${k.copy}: file`);
    assert.equal(entry.machine, k.machine, `${k.copy}: machine`);
    assert.ok(k.reason.length > 0, `${k.copy}: reason`);
  }
});

for (const entry of MANIFEST) {
  test(`conformance: ${entry.copy} (${entry.file}) is ${entry.relation} to ${entry.machine}`, () => {
    const found = extractCopy(entry);
    const machine = machineByName(entry.machine);
    const actual = driftOf(declaredValues(machine, entry.against), found, entry.relation).map(fmt).sort();
    const known = KNOWN_DRIFT.filter((k) => k.copy === entry.copy).map(fmt).sort();

    const unexpected = actual.filter((d) => !known.includes(d));
    const stale = known.filter((d) => !actual.includes(d));
    assert.deepEqual(
      unexpected,
      [],
      `${entry.file}: NEW drift from ${entry.machine} (found [${found.join(', ')}]). ` +
        'Fix the copy, or — if the copy is right — fix the machine definition.',
    );
    assert.deepEqual(
      stale,
      [],
      `${entry.file}: KNOWN_DRIFT entries no longer reproduce — delete them so the list shrinks.`,
    );
  });
}
