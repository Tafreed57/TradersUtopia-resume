-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MESSAGE', 'MENTION', 'SERVER_UPDATE', 'FRIEND_REQUEST', 'SYSTEM', 'PAYMENT', 'SECURITY');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "backupCodes" TEXT[],
ADD COLUMN     "emailNotifications" JSONB DEFAULT '{"system":true,"security":true,"payment":true,"messages":true,"mentions":true,"serverUpdates":false}',
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pushNotifications" JSONB DEFAULT '{"system":true,"security":true,"payment":true,"messages":true,"mentions":true,"serverUpdates":false}',
ADD COLUMN     "pushSubscriptions" JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeProductId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT,
ADD COLUMN     "subscriptionEnd" TIMESTAMP(3),
ADD COLUMN     "subscriptionStart" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");
