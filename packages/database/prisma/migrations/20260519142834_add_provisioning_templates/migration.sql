-- Migration: add_provisioning_templates
--
-- O6 — per-org reusable Display provisioning config. Operator creates a
-- template once (default orientation, timezone, default playlist), then
-- references it when pairing N displays. Eliminates per-device config for
-- growing fleets.
--
-- - organizationId FK ON DELETE CASCADE: org delete cascades everything.
-- - defaultPlaylistId FK ON DELETE SET NULL: playlist delete preserves the
--   template in a broken-but-recoverable state (admin must pick a new
--   playlist). Same philosophy as O4's tag-rule playlistId cascade choice.
-- - (organizationId, name) unique for UI uniqueness + idempotent backfill.
--
-- Plan: tasks/.hermes-check-receipts/o6-mass-provisioning.json
-- Audit ref: docs/plans/2026-05-17-optsigns-vizora-feature-gap.md P1 #7

CREATE TABLE "provisioning_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultOrientation" TEXT NOT NULL DEFAULT 'landscape',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultPlaylistId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provisioning_templates_organizationId_name_key" ON "provisioning_templates"("organizationId", "name");
CREATE INDEX "provisioning_templates_organizationId_idx" ON "provisioning_templates"("organizationId");
CREATE INDEX "provisioning_templates_defaultPlaylistId_idx" ON "provisioning_templates"("defaultPlaylistId");

ALTER TABLE "provisioning_templates" ADD CONSTRAINT "provisioning_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provisioning_templates" ADD CONSTRAINT "provisioning_templates_defaultPlaylistId_fkey" FOREIGN KEY ("defaultPlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
