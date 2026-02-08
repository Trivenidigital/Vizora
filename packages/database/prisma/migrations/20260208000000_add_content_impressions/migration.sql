-- CreateTable
CREATE TABLE "content_impressions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "playlistId" TEXT,
    "duration" INTEGER,
    "completionPercentage" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,

    CONSTRAINT "content_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_impressions_organizationId_date_idx" ON "content_impressions"("organizationId", "date");
CREATE INDEX "content_impressions_contentId_date_idx" ON "content_impressions"("contentId", "date");
CREATE INDEX "content_impressions_displayId_date_idx" ON "content_impressions"("displayId", "date");

-- AddForeignKey
ALTER TABLE "content_impressions" ADD CONSTRAINT "content_impressions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_impressions" ADD CONSTRAINT "content_impressions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_impressions" ADD CONSTRAINT "content_impressions_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_impressions" ADD CONSTRAINT "content_impressions_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
