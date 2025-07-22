/*
  Warnings:

  - You are about to drop the `TrackRecordMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TrackRecordMessage" DROP CONSTRAINT "TrackRecordMessage_adminId_fkey";

-- DropTable
DROP TABLE "TrackRecordMessage";

-- CreateTable
CREATE TABLE "timer" (
    "id" TEXT NOT NULL,
    "durations" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "priceMessage" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timer_pkey" PRIMARY KEY ("id")
);
