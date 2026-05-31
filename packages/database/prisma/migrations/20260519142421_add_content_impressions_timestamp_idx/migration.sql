-- Migration: add_content_impressions_timestamp_idx
--
-- O2 — proof-of-play streaming export orders by `timestamp` (asc/desc)
-- but the existing indexes on (organizationId, date), (contentId, date),
-- (displayId, date) don't cover that sort. For large impression volumes
-- the streaming export would force a full-table sort.
--
-- This index makes the (filter-by-org, order-by-timestamp) path use a
-- single index range scan. PR-review fix on PR #67.

CREATE INDEX "content_impressions_organizationId_timestamp_idx" ON "content_impressions"("organizationId", "timestamp");
