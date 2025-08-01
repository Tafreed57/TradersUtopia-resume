/*
  Warnings:

  - Added the required column `updatedAt` to the `push_subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceInfo" JSONB,
ADD COLUMN     "failureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_isActive_idx" ON "push_subscriptions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "push_subscriptions_lastActive_idx" ON "push_subscriptions"("lastActive");

-- CreateIndex
CREATE INDEX "push_subscriptions_failureCount_idx" ON "push_subscriptions"("failureCount");
