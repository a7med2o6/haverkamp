-- AlterTable
ALTER TABLE "wash_subscriptions" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "wash_subscriptions_shareToken_key" ON "wash_subscriptions"("shareToken");
