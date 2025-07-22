/*
  Warnings:

  - You are about to drop the column `durations` on the `timer` table. All the data in the column will be lost.
  - Added the required column `duration` to the `timer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `timer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "timer" DROP COLUMN "durations",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
