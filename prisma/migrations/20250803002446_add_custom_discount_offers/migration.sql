-- CreateTable
CREATE TABLE "custom_discount_offers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "originalPriceCents" INTEGER NOT NULL,
    "userInputCents" INTEGER NOT NULL,
    "offerPriceCents" INTEGER NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "savingsCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_discount_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_discount_offers_userId_idx" ON "custom_discount_offers"("userId");

-- CreateIndex
CREATE INDEX "custom_discount_offers_expiresAt_idx" ON "custom_discount_offers"("expiresAt");

-- CreateIndex
CREATE INDEX "custom_discount_offers_isExpired_idx" ON "custom_discount_offers"("isExpired");

-- CreateIndex
CREATE UNIQUE INDEX "custom_discount_offers_userId_subscriptionId_key" ON "custom_discount_offers"("userId", "subscriptionId");

-- AddForeignKey
ALTER TABLE "custom_discount_offers" ADD CONSTRAINT "custom_discount_offers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
