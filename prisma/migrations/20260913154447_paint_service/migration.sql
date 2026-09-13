-- CreateEnum
CREATE TYPE "PriceApprovalMethod" AS ENUM ('CALL', 'WHATSAPP', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "PaintScope" AS ENUM ('PARTS', 'RIMS', 'FULL');

-- CreateEnum
CREATE TYPE "PaintType" AS ENUM ('PERMANENT', 'REMOVABLE');

-- CreateEnum
CREATE TYPE "PaintFinish" AS ENUM ('GLOSS', 'MATTE', 'SATIN');

-- AlterTable
ALTER TABLE "job_order_items" ADD COLUMN     "isPriced" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partKey" TEXT,
ADD COLUMN     "priceApprovalMethod" "PriceApprovalMethod",
ADD COLUMN     "priceApprovalNote" TEXT,
ADD COLUMN     "priceApprovedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "paintCode" TEXT;

-- CreateTable
CREATE TABLE "paint_details" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "scope" "PaintScope" NOT NULL,
    "type" "PaintType" NOT NULL,
    "finish" "PaintFinish" NOT NULL,
    "colorName" TEXT,
    "paintCode" TEXT,
    "formula" TEXT,
    "rimCount" INTEGER,
    "repairNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paint_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paint_details_itemId_key" ON "paint_details"("itemId");

-- AddForeignKey
ALTER TABLE "paint_details" ADD CONSTRAINT "paint_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "job_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
