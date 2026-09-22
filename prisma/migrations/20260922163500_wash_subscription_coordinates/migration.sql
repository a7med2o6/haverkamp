-- AlterTable
ALTER TABLE "wash_subscriptions" ADD COLUMN     "lat" DECIMAL(9,6),
ADD COLUMN     "lng" DECIMAL(9,6),
ADD COLUMN     "locationSetAt" TIMESTAMP(3);
