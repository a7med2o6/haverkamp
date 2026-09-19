-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_shareToken_key" ON "orders"("shareToken");

