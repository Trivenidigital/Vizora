-- Customer hot-path indexes for dashboard lists, playlist pushes, and active
-- schedule lookup. These match the query shapes used by the middleware list
-- endpoints and display schedule resolution paths.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "devices_organizationId_createdAt_idx"
  ON "devices"("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "devices_organizationId_status_createdAt_idx"
  ON "devices"("organizationId", "status", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "devices_organizationId_currentPlaylistId_idx"
  ON "devices"("organizationId", "currentPlaylistId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Content_organizationId_createdAt_idx"
  ON "Content"("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Content_organizationId_status_createdAt_idx"
  ON "Content"("organizationId", "status", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Content_organizationId_type_createdAt_idx"
  ON "Content"("organizationId", "type", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Content_organizationId_templateOrientation_createdAt_idx"
  ON "Content"("organizationId", "templateOrientation", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Playlist_organizationId_createdAt_idx"
  ON "Playlist"("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Schedule_organizationId_isActive_priority_createdAt_idx"
  ON "Schedule"("organizationId", "isActive", "priority" DESC, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Schedule_daysOfWeek_gin_idx"
  ON "Schedule" USING GIN ("daysOfWeek");
