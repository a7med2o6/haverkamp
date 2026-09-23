-- AlterTable
ALTER TABLE "orders" ADD COLUMN "receiptSentAt" TIMESTAMP(3),
ADD COLUMN "receiptError" TEXT;
