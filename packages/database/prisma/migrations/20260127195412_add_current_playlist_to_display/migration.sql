-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "currentPlaylistId" TEXT;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_currentPlaylistId_fkey" FOREIGN KEY ("currentPlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
