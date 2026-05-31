-- Migration: agent_runs_enriched_marker
--
-- Adds two columns to agent_runs in response to PR-review findings:
--
--   1. enrichedAt — proper idempotency marker for the sidecar PATCH
--      (PR-review R1 I3). Replaces the brittle `WHERE tokensIn IS NULL`
--      predicate which fails when the sidecar PATCHes outcome-only
--      refinements (no token data → tokensIn stays null → re-passes guard).
--
--   2. callerType — persists the InternalSecretGuard's x-internal-caller
--      stamp onto the row (PR-review R2 I5). Was stamped on req object
--      but never read; now durable for forensic attribution if the shared
--      INTERNAL_API_SECRET ever leaks.
--
-- Both columns are nullable; backfill is unnecessary. Existing rows get
-- callerType=NULL (correct — pre-redesign, no caller identification was
-- captured) and enrichedAt=NULL (correct — they were never enriched).

ALTER TABLE "agent_runs" ADD COLUMN "callerType" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "enrichedAt" TIMESTAMP(3);
