-- AlterTable: Add isGlobal field to Content for template library support
ALTER TABLE "Content" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Composite index for efficient template library queries
CREATE INDEX "Content_isGlobal_type_idx" ON "Content"("isGlobal", "type");
