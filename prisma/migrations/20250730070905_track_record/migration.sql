-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "isTrackRecord" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "channels_isTrackRecord_idx" ON "channels"("isTrackRecord");
