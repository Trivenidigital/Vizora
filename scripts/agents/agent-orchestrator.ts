#!/usr/bin/env npx tsx
/**
 * Vizora Agent System — Orchestrator SCAFFOLD
 *
 * Intended scope (not yet implemented):
 *   - Read all family state files (customer/content/fleet/billing/ops)
 *   - Correlate incidents by organizationId first (D14)
 *   - Writes only to its own state + CustomerIncident via API (D2)
 *     — never mutates another agent's state file
 *
 * Gated OFF by default. Set AGENT_ORCHESTRATOR_ENABLED=true to activate.
 *
 * **Hermes-first rule (2026-05-04):** Hermes Agent IS the orchestrator
 * runtime. When this is implemented, do NOT build a custom orchestration
 * loop in TypeScript — instead, write a Hermes skill at
 * `hermes-skills/vizora-orchestrator/SKILL.md` that uses Hermes's
 * built-in `delegate_task` tool to spawn the per-family skills as
 * sub-agents (parallel where independent, sequential where one's
 * output drives the next). The MCP server provides cross-family read
 * tools (`list_open_customer_incidents`, etc — to be added). See
 * `feedback_hermes_first_for_agents` in user memory and
 * docs/agents-architecture.md for the dispatcher-first routing rule
 * that this orchestrator must follow.
 */

import 'dotenv/config';
import { log } from './lib/alerting.js';

const AGENT = 'agent-orchestrator';
const ENABLED = process.env.AGENT_ORCHESTRATOR_ENABLED === 'true';

async function main(): Promise<void> {
  if (!ENABLED) {
    log(AGENT, 'disabled via AGENT_ORCHESTRATOR_ENABLED — exiting');
    process.exitCode = 0;
    return;
  }
  log(AGENT, 'scaffold — full implementation pending');
  process.exitCode = 0;
}

main().catch(err => {
  log(AGENT, `fatal: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
