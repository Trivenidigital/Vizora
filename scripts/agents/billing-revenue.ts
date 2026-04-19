#!/usr/bin/env npx tsx
/**
 * Vizora Agent System — Billing & Revenue SCAFFOLD (READ-ONLY)
 *
 * Intended scope (not yet implemented):
 *   - Snapshot MRR / ARR from BillingTransaction
 *   - Detect anomalies (spike/drop) versus rolling window
 *   - Never mutates billing state (D1 — read-only)
 *
 * Gated OFF by default. Set BILLING_REVENUE_ENABLED=true to activate.
 */

import 'dotenv/config';
import { log } from './lib/alerting.js';

const AGENT = 'billing-revenue';
const ENABLED = process.env.BILLING_REVENUE_ENABLED === 'true';

async function main(): Promise<void> {
  if (!ENABLED) {
    log(AGENT, 'disabled via BILLING_REVENUE_ENABLED — exiting');
    process.exitCode = 0;
    return;
  }
  log(AGENT, 'scaffold (read-only) — full implementation pending');
  process.exitCode = 0;
}

main().catch(err => {
  log(AGENT, `fatal: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
