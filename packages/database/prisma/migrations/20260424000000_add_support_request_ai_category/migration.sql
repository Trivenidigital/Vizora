-- Add aiCategory column to support_requests for TicketCategoryV2 classification.
-- See docs/hermes/ticket-categories-2026-04-24.md.
-- Nullable by design: legacy rows remain NULL until re-triaged; support-triage
-- populates on new tickets. No backfill — we deliberately want 30 days of live
-- data to validate the taxonomy before any retrospective labeling.

ALTER TABLE "support_requests" ADD COLUMN "aiCategory" TEXT;
