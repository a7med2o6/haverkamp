-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "formerJobOrderId" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
