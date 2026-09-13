-- AlterTable
ALTER TABLE "wash_subscriptions" ADD COLUMN     "defaultWasherId" TEXT;

-- CreateIndex
CREATE INDEX "wash_subscriptions_defaultWasherId_idx" ON "wash_subscriptions"("defaultWasherId");

-- AddForeignKey
ALTER TABLE "wash_subscriptions" ADD CONSTRAINT "wash_subscriptions_defaultWasherId_fkey" FOREIGN KEY ("defaultWasherId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
