/**
 * Fixture corpus for classifyCategoryV2.
 *
 * Purpose: lock in classifier behavior BEFORE the 30-day measurement gate
 * (2026-05-24) so a drive-by regex tweak can't silently invalidate the
 * in-flight production histogram. See tasks/hermes-backlog.md.
 *
 * Coverage targets:
 *   - Every TicketCategoryV2 slug has at least 2 positive cases
 *   - Adversarial cases lifted directly from the PR #36 review:
 *       * smart-quotes (Word/macOS autocorrect)
 *       * 'ad' word-boundary (address / admin / advice / added must NOT fire)
 *       * 'member' routed to billing (seat-count decision) not permissions
 *       * 'charge' collision (device power vs billing)
 *   - Sparse text / legacy-category-only fallbacks
 *   - Explicit 'other' bucket (neither keywords nor legacy category match)
 *
 * What this test does NOT assert:
 *   - Nothing about SupportRequest persistence, D7 re-triage, or D8 cross-org
 *     guards. Those live in support-triage integration territory, not here.
 *     The classifier itself is a pure function — tested as such.
 */

import { classifyCategoryV2, asTicketCategoryV2, V2_SLUGS } from '../src/lib/classify-ticket-v2';
import type { TicketCategoryV2 } from '../src/types/agent-signals';

interface Fixture {
  name: string;
  title: string | null;
  description: string | null;
  legacyCategory: string | null;
  expected: TicketCategoryV2;
}

// ─── Device family ──────────────────────────────────────────────────────────
const device: Fixture[] = [
  {
    name: 'pairing code expired',
    title: 'Pairing code expired',
    description: 'Tried to pair our new screen but the code expired before I could type it',
    legacyCategory: 'display',
    expected: 'device_pairing_failed',
  },
  {
    name: 'pairing failure smart-quote',
    title: 'Screen won\u2019t pair',
    description: 'New TV just arrived and pairing won\u2019t work no matter what I do',
    legacyCategory: 'display',
    expected: 'device_pairing_failed',
  },
  {
    name: 'display offline at restaurant',
    title: 'Restaurant display offline',
    description: 'The screen at our downtown location went offline this morning and has not reconnected',
    legacyCategory: 'display',
    expected: 'device_offline',
  },
  {
    name: 'TV disconnected from network',
    title: 'TV disconnected',
    description: 'Lobby TV shows as disconnected in the dashboard but the cable is plugged in',
    legacyCategory: null,
    expected: 'device_offline',
  },
  {
    name: 'wrong content playing',
    title: 'Wrong playlist showing',
    description: 'The screen is showing old content instead of the new playlist I pushed',
    legacyCategory: 'content',
    expected: 'device_wrong_content',
  },
  {
    name: 'stuck on old ad',
    title: 'Stuck on old ad',
    description: 'Display is stuck on an old ad from last week instead of our current campaign',
    legacyCategory: null,
    expected: 'device_wrong_content',
  },
  {
    name: 'playback black screen',
    title: 'Video playback error',
    description: 'mp4 files play for a few seconds then go to black screen',
    legacyCategory: 'technical',
    expected: 'device_playback_error',
  },
  {
    name: 'stream frozen',
    title: 'Stream frozen on TV',
    description: 'Video stream is frozen, audio still plays but picture is stuck',
    legacyCategory: null,
    expected: 'device_playback_error',
  },
  {
    name: 'rotation wrong',
    title: 'Screen rotation is wrong',
    description: 'TV is locked in portrait but we need landscape orientation',
    legacyCategory: 'display',
    expected: 'device_display_config',
  },
  {
    name: 'timezone drift on device',
    title: 'Clock wrong on device',
    description: 'Device clock is showing the wrong timezone, off by several hours',
    legacyCategory: null,
    expected: 'device_display_config',
  },
];

// ─── Content family ─────────────────────────────────────────────────────────
const content: Fixture[] = [
  {
    name: 'upload stuck',
    title: 'Upload stuck at 80%',
    description: 'My video upload is stuck and never completes',
    legacyCategory: 'content',
    expected: 'content_upload_failed',
  },
  {
    name: 'cant upload image',
    title: 'Can\u2019t upload image',
    description: 'Getting an error every time I try to upload a new image, says upload failed',
    legacyCategory: 'content',
    expected: 'content_upload_failed',
  },
  {
    name: 'content not showing',
    title: 'New image not showing',
    description: 'I uploaded a new image but it is not showing on the playlist at all',
    legacyCategory: 'content',
    expected: 'content_not_showing',
  },
  {
    name: 'ad never appeared',
    title: 'Ad never appeared',
    description: 'Scheduled our new ad for this morning but it never appeared on any screen',
    legacyCategory: null,
    expected: 'content_not_showing',
  },
  {
    name: 'content expired early',
    title: 'Content expired early',
    description: 'Our ad disappeared before its end date and went dark, too early',
    legacyCategory: 'content',
    expected: 'content_expired',
  },
  {
    name: 'image ran out',
    title: 'Image ran out yesterday',
    description: 'Summer sale image ran out yesterday but expiration was supposed to be next week',
    legacyCategory: null,
    expected: 'content_expired',
  },
  {
    name: 'template broken render',
    title: 'Template rendering broken',
    description: 'The weekly specials template renders blank on the screen, variable missing',
    legacyCategory: 'content',
    expected: 'content_template_broken',
  },
  {
    name: 'template wrong output',
    title: 'Template wrong',
    description: 'Promo template is showing wrong fields in the output',
    legacyCategory: null,
    expected: 'content_template_broken',
  },
  {
    name: 'storage quota hit',
    title: 'Storage limit reached',
    description: 'Dashboard says we hit our storage quota — what are our options to free space?',
    legacyCategory: 'content',
    expected: 'content_storage_limit',
  },
  {
    name: 'file too large',
    title: 'File too large',
    description: 'Tried to upload a big video but it says the file is too big for the size limit',
    legacyCategory: null,
    expected: 'content_storage_limit',
  },
];

// ─── Schedule family ────────────────────────────────────────────────────────
const schedule: Fixture[] = [
  {
    name: 'schedule did not trigger',
    title: 'Schedule didn\u2019t play',
    description: 'Our lunch schedule was supposed to play at 11am but it didn\u2019t play',
    legacyCategory: null,
    expected: 'schedule_not_playing',
  },
  {
    name: 'schedule not starting',
    title: 'Schedule not starting',
    description: 'The evening schedule will not start running on its own',
    legacyCategory: null,
    expected: 'schedule_not_playing',
  },
  {
    name: 'DST offset hour',
    title: 'Schedule off by one hour',
    description: 'Since the DST change the schedule is off by an hour on all displays',
    legacyCategory: null,
    expected: 'schedule_timezone_issue',
  },
  {
    name: 'wrong time zone',
    title: 'Scheduled content running at wrong time',
    description: 'Schedule is firing hours off — our time zone looks set incorrectly',
    legacyCategory: null,
    expected: 'schedule_timezone_issue',
  },
  {
    name: 'two schedules overlap',
    title: 'Schedule overlap',
    description: 'Two schedules overlap at noon and I can\u2019t figure out which one wins, there is a conflict',
    legacyCategory: null,
    expected: 'schedule_conflict',
  },
  {
    name: 'both schedules collision',
    title: 'Schedules collide',
    description: 'Both schedules run at 3pm and we have a collision every day',
    legacyCategory: null,
    expected: 'schedule_conflict',
  },
  {
    name: 'coverage dead air',
    title: 'Dead air between schedules',
    description: 'There is a gap in our schedule coverage between 5 and 6 pm, nothing showing',
    legacyCategory: null,
    expected: 'schedule_coverage_gap',
  },
  {
    name: 'gap in daily schedule',
    title: 'Gap in schedule',
    description: 'Schedule has a coverage gap at midnight with blank between the two blocks',
    legacyCategory: null,
    expected: 'schedule_coverage_gap',
  },
];

// ─── Analytics family ───────────────────────────────────────────────────────
const analytics: Fixture[] = [
  {
    name: 'analytics empty',
    title: 'Analytics missing',
    description: 'The analytics dashboard is showing no data for the last 7 days',
    legacyCategory: null,
    expected: 'analytics_missing_data',
  },
  {
    name: 'stats blank',
    title: 'Stats blank',
    description: 'My metrics dashboard is blank even though I know the screens are playing',
    legacyCategory: null,
    expected: 'analytics_missing_data',
  },
  {
    name: 'impression count wrong',
    title: 'Impression count wrong',
    description: 'Impression count is wrong compared to what we see in Google Analytics, discrepancy is large',
    legacyCategory: null,
    expected: 'analytics_wrong_count',
  },
  {
    name: 'play count doesn\u2019t match',
    title: 'Play count mismatch',
    description: 'Play count doesn\u2019t match between the report and the player logs',
    legacyCategory: null,
    expected: 'analytics_wrong_count',
  },
  {
    name: 'csv export blank',
    title: 'Export failed',
    description: 'CSV export of our analytics fails every time, downloaded file is corrupt',
    legacyCategory: null,
    expected: 'analytics_export_failed',
  },
  {
    name: 'pdf report export error',
    title: 'Report export error',
    description: 'Export of the weekly analytics report fails every time I run it, corrupt pdf',
    legacyCategory: null,
    expected: 'analytics_export_failed',
  },
];

// ─── Account family ────────────────────────────────────────────────────────
const account: Fixture[] = [
  {
    name: 'forgot password',
    title: 'Forgot password',
    description: 'I forgot my password and the reset link email never arrives',
    legacyCategory: 'account',
    expected: 'account_access_lost',
  },
  {
    name: 'locked out of account',
    title: 'Locked out',
    description: 'Locked out of my account, says too many login attempts',
    legacyCategory: 'account',
    expected: 'account_access_lost',
  },
  {
    name: 'mfa device lost',
    title: 'Lost MFA device',
    description: 'Lost my phone so I can\u2019t access my 2fa codes and I\u2019m locked out',
    legacyCategory: 'account',
    expected: 'account_access_lost',
  },
  {
    name: 'permission denied',
    title: 'Access denied on edit',
    description: 'I have permission issues — cannot edit playlists even though I should have admin rights',
    legacyCategory: 'account',
    expected: 'account_permissions',
  },
  {
    name: 'role wrong',
    title: 'Role wrong',
    description: 'My role is set to viewer but I need editor access — not authorized to make changes',
    legacyCategory: 'account',
    expected: 'account_permissions',
  },
];

// ─── Billing family ─────────────────────────────────────────────────────────
const billing: Fixture[] = [
  {
    name: 'invoice question',
    title: 'Invoice question',
    description: 'Have a question about my last invoice, the amount seems wrong',
    legacyCategory: 'billing',
    expected: 'billing_invoice_question',
  },
  {
    name: 'refund request',
    title: 'Refund request',
    description: 'Please process a refund for last month\u2019s subscription, we downgraded',
    legacyCategory: 'billing',
    expected: 'billing_invoice_question',
  },
  {
    name: 'credit card failed',
    title: 'Payment failed',
    description: 'My credit card payment failed and now we are in a past-due state',
    legacyCategory: 'billing',
    expected: 'billing_invoice_question',
  },
  {
    name: 'plan change question',
    title: 'Plan change',
    description: 'Want to change our plan from starter to pro — how does the subscription proration work?',
    legacyCategory: 'billing',
    expected: 'billing_invoice_question',
  },
];

// ─── Adversarial cases (PR #36 review) ─────────────────────────────────────
const adversarial: Fixture[] = [
  // Smart quotes — Word/macOS autocorrect must not bypass /won'?t/ rules
  {
    name: 'adversarial: won\u2019t pair smart quote',
    title: 'Pairing won\u2019t work',
    description: 'Pairing code won\u2019t work, same every time',
    legacyCategory: null,
    expected: 'device_pairing_failed',
  },
  {
    name: 'adversarial: can\u2019t upload smart quote',
    title: 'Can\u2019t upload',
    description: 'Upload fails at the last step, can\u2019t upload any of the new files',
    legacyCategory: null,
    expected: 'content_upload_failed',
  },

  // 'ad' word boundary — 'address' / 'admin' / 'advice' / 'added' must NOT fire
  {
    name: 'adversarial: address must not be ad',
    title: 'Billing address update',
    description: 'I need to update our billing address on the invoice',
    legacyCategory: 'billing',
    expected: 'billing_invoice_question',
  },
  {
    name: 'adversarial: admin must not be ad',
    title: 'Admin rights missing',
    description: 'I do not have admin rights on the dashboard, permission was denied',
    legacyCategory: 'account',
    expected: 'account_permissions',
  },
  {
    name: 'adversarial: added must not be ad',
    title: 'Feature request',
    description: 'Would love to see playlist copy added to the product, any ETA?',
    legacyCategory: null,
    expected: 'other',
  },

  // 'member' — seat/member routed to billing (material decision), not permissions
  {
    name: 'adversarial: add team member to plan',
    title: 'Add team member',
    description: 'I need to add a new team member to our plan, how do I do that?',
    legacyCategory: null,
    expected: 'billing_invoice_question',
  },
  {
    name: 'adversarial: remove seat from subscription',
    title: 'Remove seat',
    description: 'Please remove a seat from our subscription, someone left the company',
    legacyCategory: null,
    expected: 'billing_invoice_question',
  },
  {
    name: 'adversarial: seat on plan = billing',
    title: 'Seat upgrade',
    description: 'We need another seat on our plan — currently maxed out',
    legacyCategory: null,
    expected: 'billing_invoice_question',
  },

  // 'charge' must NOT pull device-power tickets into billing
  {
    name: 'adversarial: screen won\u2019t charge (device, not billing)',
    title: 'Screen won\u2019t charge',
    description: 'Our portable display won\u2019t charge and keeps going offline when unplugged',
    legacyCategory: 'display',
    expected: 'device_offline',
  },

  // Sparse text — legacy category fallbacks
  {
    name: 'sparse: bare billing category',
    title: 'help',
    description: '',
    legacyCategory: 'billing_issue',
    expected: 'billing_invoice_question',
  },
  {
    name: 'sparse: bare account category',
    title: 'help',
    description: null,
    legacyCategory: 'login_problem',
    expected: 'account_access_lost',
  },

  // Genuine 'other' fallthroughs
  {
    name: 'other: generic feature suggestion',
    title: 'Product suggestion',
    description: 'It would be nice if you could let users reorder the sidebar icons',
    legacyCategory: null,
    expected: 'other',
  },
  {
    name: 'other: thank-you note',
    title: 'Thanks!',
    description: 'Just wanted to say the new dashboard looks great',
    legacyCategory: null,
    expected: 'other',
  },
];

const ALL_FIXTURES: Fixture[] = [
  ...device,
  ...content,
  ...schedule,
  ...analytics,
  ...account,
  ...billing,
  ...adversarial,
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('classifyCategoryV2 — fixture corpus', () => {
  it.each(ALL_FIXTURES.map((f) => [f.name, f]))(
    '%s',
    (_name, f: Fixture) => {
      const actual = classifyCategoryV2(f.title, f.description, f.legacyCategory);
      expect(actual).toBe(f.expected);
    },
  );

  it('covers every TicketCategoryV2 slug with at least one positive fixture', () => {
    const coverage = new Set(ALL_FIXTURES.map((f) => f.expected));
    const uncovered = [...V2_SLUGS].filter((slug) => !coverage.has(slug));
    expect(uncovered).toEqual([]);
  });

  it('keeps the corpus at a statistically useful size', () => {
    // 50-ticket floor per tasks/hermes-backlog.md — regression corpus, not a
    // proof. If this fires, add fixtures before shrinking the bar.
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(50);
  });
});

describe('asTicketCategoryV2 — boundary guard', () => {
  it('returns null for null or undefined', () => {
    expect(asTicketCategoryV2(null)).toBeNull();
    expect(asTicketCategoryV2(undefined)).toBeNull();
  });

  it('returns the slug when it is a known TicketCategoryV2 value', () => {
    expect(asTicketCategoryV2('device_offline')).toBe('device_offline');
    expect(asTicketCategoryV2('billing_invoice_question')).toBe('billing_invoice_question');
    expect(asTicketCategoryV2('other')).toBe('other');
  });

  it('falls to other for unknown strings (future-classifier safety)', () => {
    expect(asTicketCategoryV2('device_pairing_v3_failed')).toBe('other');
    expect(asTicketCategoryV2('')).toBe('other');
    expect(asTicketCategoryV2('anything_else')).toBe('other');
  });
});
