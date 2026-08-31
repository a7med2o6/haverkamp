-- CreateTable
CREATE TABLE "job_order_item_assignees" (
    "itemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_order_item_assignees_pkey" PRIMARY KEY ("itemId","employeeId")
);

-- CreateIndex
CREATE INDEX "job_order_item_assignees_employeeId_idx" ON "job_order_item_assignees"("employeeId");

-- AddForeignKey
ALTER TABLE "job_order_item_assignees" ADD CONSTRAINT "job_order_item_assignees_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "job_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_order_item_assignees" ADD CONSTRAINT "job_order_item_assignees_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
