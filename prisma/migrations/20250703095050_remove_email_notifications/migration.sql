/*
  Warnings:

  - You are about to drop the column `emailNotifications` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorEnabled` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorSecret` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "emailNotifications",
DROP COLUMN "twoFactorEnabled",
DROP COLUMN "twoFactorSecret";
