-- Support paged folder content-library queries by organization, folder, and
-- newest-first ordering. This matches GET /folders/:id/content.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Content_organizationId_folderId_createdAt_idx"
  ON "Content"("organizationId", "folderId", "createdAt" DESC);
