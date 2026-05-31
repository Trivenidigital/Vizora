-- Migration: add_tag_assignment_rules
--
-- O4 — Tag-rule auto-assignment engine.
--
-- Per-org rule: "every Display with tag X auto-assigns Playlist Y as its
-- currentPlaylistId" — first-write-wins (manual assignments never overwritten).
--
-- - Lower priority number = higher precedence (1 = highest, 100 = default,
--   999 = lowest). Ties broken by createdAt (older wins).
-- - playlistId uses ON DELETE SET NULL so playlist deletion preserves the
--   rule in a broken state (evaluator logs WARN and skips it).
-- - tagId uses ON DELETE CASCADE (no tag = no trigger; rule is meaningless
--   without its tag).
-- - organizationId uses ON DELETE CASCADE (standard tenant cleanup pattern).
--
-- Plan + design: tasks/plans/o4-tag-rule-auto-assignment-{plan,design}.md
-- Audit ref: docs/plans/2026-05-17-optsigns-vizora-feature-gap.md P0 #2
-- Pattern reference: PR #63 (O7 alert rules — same shape for rule engines).

-- CreateTable
CREATE TABLE "tag_assignment_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "playlistId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (UI uniqueness + idempotent create on (org, name))
CREATE UNIQUE INDEX "tag_assignment_rules_organizationId_name_key" ON "tag_assignment_rules"("organizationId", "name");

-- CreateIndex (evaluator query: WHERE organizationId = ? AND isActive = true)
CREATE INDEX "tag_assignment_rules_organizationId_isActive_idx" ON "tag_assignment_rules"("organizationId", "isActive");

-- CreateIndex (evaluator IN clause + future SetNull cascade lookups)
CREATE INDEX "tag_assignment_rules_tagId_idx" ON "tag_assignment_rules"("tagId");
CREATE INDEX "tag_assignment_rules_playlistId_idx" ON "tag_assignment_rules"("playlistId");

-- AddForeignKey
ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (tag delete removes the rule)
ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (playlist delete leaves the rule with playlistId=null; evaluator detects + skips + logs WARN)
ALTER TABLE "tag_assignment_rules" ADD CONSTRAINT "tag_assignment_rules_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
