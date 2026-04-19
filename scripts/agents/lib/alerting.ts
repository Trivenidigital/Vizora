/**
 * Vizora Agent System — Alerting + Customer Email
 *
 * Re-exports the ops-layer notification helpers (log, sendSlackAlert,
 * sendEmailAlert, updateDashboard) and adds the agent-specific
 * `sendCustomerEmail()` with safeguards:
 *
 *   - SHA-256 email hashing in audit logs (D-sec-R2-1, no PII)
 *   - TEST_EMAILS allowlist iterated in full (D-sec-R2-2)
 *   - Persisted `emailsSentThisRun` counter passed in + updated (D-sec-R2-3)
 */

import { createHash } from 'node:crypto';
import { log } from '../../ops/lib/alerting.js';
import { writeAgentState } from './state.js';
import type { AgentFamily, AgentFamilyState } from './types.js';

export { log, sendSlackAlert, sendEmailAlert, updateDashboard } from '../../ops/lib/alerting.js';

// ─── Email sending with safeguards ──────────────────────────────────────────

/** SHA-256 first-10-hex of lowercased email. Safe for audit logs. */
export function maskEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10);
}

/**
 * Resolve recipient list based on env flags:
 *   - TEST_EMAILS non-empty → all allowlist entries (D-sec-R2-2)
 *   - LIFECYCLE_LIVE=true → org admin real email
 *   - else → [] (dry-run)
 */
export function resolveRecipients(
  orgAdminEmail: string,
  opts: { live: boolean; testEmails: string[] },
): string[] {
  if (opts.testEmails.length > 0) return [...opts.testEmails];
  if (opts.live) return [orgAdminEmail];
  return [];
}

export interface SendCustomerEmailOpts {
  orgId: string;
  adminEmail: string;
  template: string;
  payload: Record<string, unknown>;
  live: boolean;
  testEmails: string[];
  maxThisRun: number;
  family: AgentFamily;           // which state file owns the counter
  state: AgentFamilyState;       // mutated + written per send (persisted)
  send?: (to: string, template: string, payload: Record<string, unknown>) => Promise<void>;
  agent: string;                 // for log tag
}

/**
 * Returns `'sent' | 'dry-run' | 'circuit-breaker'` so callers can branch.
 * All decisions are audit-logged as JSON.
 */
export async function sendCustomerEmail(opts: SendCustomerEmailOpts):
  Promise<'sent' | 'dry-run' | 'circuit-breaker'> {
  const counter = opts.state.emailsSentThisRun ?? 0;
  if (counter >= opts.maxThisRun) {
    process.stdout.write(JSON.stringify({
      type: 'lifecycle-send-decision',
      orgId: opts.orgId,
      template: opts.template,
      result: 'circuit-breaker',
      counter,
      maxThisRun: opts.maxThisRun,
      ts: new Date().toISOString(),
    }) + '\n');
    return 'circuit-breaker';
  }

  const recipients = resolveRecipients(opts.adminEmail, {
    live: opts.live,
    testEmails: opts.testEmails,
  });

  process.stdout.write(JSON.stringify({
    type: 'lifecycle-send-decision',
    orgId: opts.orgId,
    template: opts.template,
    recipientCount: recipients.length,
    recipientHashes: recipients.map(maskEmail),
    wouldSend: recipients.length > 0,
    ts: new Date().toISOString(),
  }) + '\n');

  if (recipients.length === 0) return 'dry-run';

  for (const to of recipients) {
    if (opts.send) {
      await opts.send(to, opts.template, opts.payload);
    } else {
      // No send fn wired in — treat as dry-run (tests/CI)
      log(opts.agent, `(no send fn) would have sent ${opts.template} to ${maskEmail(to)}`);
    }
    opts.state.emailsSentThisRun = (opts.state.emailsSentThisRun ?? 0) + 1;
    // NB: writeAgentState acquires the lock; caller must have already
    // released it before this call. Lifecycle re-acquires on each loop.
    writeAgentState(opts.family, opts.state);
  }
  return 'sent';
}
