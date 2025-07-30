/*
  Warnings:

  - You are about to drop the column `automaticTax` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `billingCycleAnchor` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `cancelAt` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `cancelAtPeriodEnd` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `canceledAt` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `collectionMethod` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `created` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `currentPeriodStart` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `defaultPaymentMethod` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `discountName` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `discountPercent` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `lastInvoiceUrl` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `latestInvoice` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `pendingSetupIntent` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `pendingUpdate` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `trialEnd` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `trialStart` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "automaticTax",
DROP COLUMN "billingCycleAnchor",
DROP COLUMN "cancelAt",
DROP COLUMN "cancelAtPeriodEnd",
DROP COLUMN "canceledAt",
DROP COLUMN "collectionMethod",
DROP COLUMN "created",
DROP COLUMN "currency",
DROP COLUMN "currentPeriodStart",
DROP COLUMN "defaultPaymentMethod",
DROP COLUMN "description",
DROP COLUMN "discountName",
DROP COLUMN "discountPercent",
DROP COLUMN "endedAt",
DROP COLUMN "items",
DROP COLUMN "lastInvoiceUrl",
DROP COLUMN "latestInvoice",
DROP COLUMN "metadata",
DROP COLUMN "pendingSetupIntent",
DROP COLUMN "pendingUpdate",
DROP COLUMN "startDate",
DROP COLUMN "trialEnd",
DROP COLUMN "trialStart";
