-- AddForeignKey (support_messages -> organizations via organizationId)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_messages_organizationId_fkey' AND table_name = 'support_messages') THEN
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Schedule_organizationId_isActive_idx" ON "Schedule"("organizationId", "isActive");
