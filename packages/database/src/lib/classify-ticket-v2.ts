/**
 * Heuristic classifier for `TicketCategoryV2` — no LLM cost, no PII leak.
 *
 * See `docs/hermes/ticket-categories-2026-04-24.md` for taxonomy rationale,
 * v1/v2/fix/escalate tiers, and the 30-day measurement gate.
 *
 * Design:
 *   - Order matters. Most-specific patterns fire first so 'device pairing'
 *     wins over 'device'. Seat/member-management routes to billing before
 *     account_permissions because the seat-count change is the material
 *     decision.
 *   - Curly apostrophes (U+2019 and U+2018) are normalized up front. Without
 *     this, Word/macOS autocorrect silently bypasses every /won'?t/ rule.
 *   - 'ad' and 'member' are word-bounded (or narrowed) because unbounded
 *     /ad/ pulls in 'address', 'admin', 'advice', 'added', and 'member'
 *     alone fires on every "team member on my plan" (which is billing).
 *   - 'charge' / 'charged' is absent by design — it collides with device-
 *     power tickets ('screen won\u2019t charge'). The strong billing tokens
 *     (invoice, refund, payment, credit card, subscription, plan change)
 *     carry the category on their own.
 *   - Misclassifications fall to 'other'. That's a signal, not a failure.
 */

import type { TicketCategoryV2 } from '../types/agent-signals.js';

export const V2_SLUGS: ReadonlySet<TicketCategoryV2> = new Set<TicketCategoryV2>([
  'device_pairing_failed',
  'device_offline',
  'device_wrong_content',
  'device_playback_error',
  'device_display_config',
  'content_upload_failed',
  'content_not_showing',
  'content_expired',
  'content_template_broken',
  'content_storage_limit',
  'schedule_not_playing',
  'schedule_timezone_issue',
  'schedule_conflict',
  'schedule_coverage_gap',
  'analytics_missing_data',
  'analytics_wrong_count',
  'analytics_export_failed',
  'account_access_lost',
  'account_permissions',
  'billing_invoice_question',
  'other',
]);

/**
 * Boundary guard for read-side consumers. Prisma exposes `aiCategory` as
 * `string | null`. Later classifier versions may emit slugs this union
 * doesn\u2019t know about; casting would type-launder them past exhaustive
 * switches. Use this helper instead — unknown values fall to 'other'.
 */
export function asTicketCategoryV2(s: string | null | undefined): TicketCategoryV2 | null {
  if (s == null) return null;
  return V2_SLUGS.has(s as TicketCategoryV2) ? (s as TicketCategoryV2) : 'other';
}

export function classifyCategoryV2(
  title: string | null | undefined,
  description: string | null | undefined,
  legacyCategory: string | null | undefined,
): TicketCategoryV2 {
  const raw = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  const text = raw.replace(/[\u2018\u2019]/g, "'");
  const cat = (legacyCategory ?? '').toLowerCase();

  // Device family
  if (/pair(ing)?\s*(code|fail|error|expired|won'?t|not work)/.test(text)) return 'device_pairing_failed';
  if (/(screen|display|device|tv)[^.]*(offline|disconnect(ed)?|not (connect|reach|online))/.test(text)) return 'device_offline';
  if (/(wrong|old|stuck on|showing.*instead).*(content|playlist|video|image|\b(?:ad|ads|advert)\b)/.test(text)) return 'device_wrong_content';
  if (/(video|audio|playback|mp4|stream)[^.]*(error|fail|broken|black screen|blank|frozen|stutter)/.test(text)) return 'device_playback_error';
  if (/(resolution|rotation|orientation|portrait|landscape|upside down|timezone|clock)/.test(text)) return 'device_display_config';

  // Content family
  if (/upload[^.]*(fail|error|stuck|rejected|timeout)|can'?t upload|won'?t upload/.test(text)) return 'content_upload_failed';
  if (/(not showing|didn'?t show|isn'?t showing|never appeared|missing from)/.test(text) && /(content|image|video|\b(?:ad|ads|advert)\b|playlist)/.test(text)) return 'content_not_showing';
  if (/(expir|disappeared|gone missing|ran out|end date)/.test(text) && /(content|\b(?:ad|ads|advert)\b|image|video)/.test(text)) return 'content_expired';
  if (/template[^.]*(broken|blank|wrong|render|error|missing|variable)/.test(text)) return 'content_template_broken';
  if (/(storage|quota|limit|too large|size limit|too big|over.*limit)/.test(text)) return 'content_storage_limit';

  // Schedule family
  if (/schedul[^.]*(not play|didn'?t play|not trigger|not work|not start|not run)/.test(text)) return 'schedule_not_playing';
  if (/(timezone|time zone|dst|daylight saving|hours? off|off by.*hour|wrong time)/.test(text)) return 'schedule_timezone_issue';
  if (/(overlap|conflict|two schedules|both schedules|collision)/.test(text) && text.includes('schedul')) return 'schedule_conflict';
  if (/(gap|dead air|nothing showing|blank between|coverage)/.test(text) && text.includes('schedul')) return 'schedule_coverage_gap';

  // Analytics family
  if (/(analytics|metrics|stats|dashboard|report)[^.]*(missing|no data|empty|blank|not showing)/.test(text)) return 'analytics_missing_data';
  if (/(impression|view count|play count|count)[^.]*(wrong|off|incorrect|doesn'?t match|discrepan)/.test(text)) return 'analytics_wrong_count';
  if (/export[^.]*(fail|error|blank|empty|corrupt)/.test(text) && /(report|analytics|csv|pdf)/.test(text)) return 'analytics_export_failed';

  // Account / Billing — seat/member-management checked before the narrower
  // billing/permissions trunk so 'add a team member to my plan' routes to
  // billing (material decision) rather than permissions (downstream grant).
  if (/\b(add|invite|remove|grant|revoke)\b[^.]{0,40}\b(team member|seat)\b/.test(text)) return 'billing_invoice_question';
  if (/\b(team member|seat)\b[^.]{0,40}\b(plan|subscription)\b/.test(text)) return 'billing_invoice_question';
  if (/(invoice|billing|refund|subscription|plan change|payment|credit card)/.test(text)) return 'billing_invoice_question';
  if (/(login|log in|sign in|password|forgot|can'?t access|mfa|2fa|locked out|reset link)/.test(text)) return 'account_access_lost';
  if (/(permission|role|access denied|not authorized|admin rights|cannot edit|\buser access\b)/.test(text)) return 'account_permissions';

  // Legacy-category fallbacks when description text is sparse
  if (cat.includes('bill') || cat.includes('pay')) return 'billing_invoice_question';
  if (cat.includes('account') || cat.includes('login') || cat.includes('auth')) return 'account_access_lost';

  return 'other';
}
