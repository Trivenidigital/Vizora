-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
