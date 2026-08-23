-- AlterTable
ALTER TABLE "job_order_items" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "job_order_items_parentId_idx" ON "job_order_items"("parentId");

-- AddForeignKey
ALTER TABLE "job_order_items" ADD CONSTRAINT "job_order_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "job_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
