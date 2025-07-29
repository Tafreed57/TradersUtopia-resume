/*
  Warnings:

  - You are about to drop the column `userId` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_userId_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "userId";
