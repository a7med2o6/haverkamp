-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "payslip_items" ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employee_advances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "monthlyDeduction" DECIMAL(12,3) NOT NULL,
    "reason" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_repayments" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "amount" DECIMAL(12,3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "advance_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_advances_employeeId_status_idx" ON "employee_advances"("employeeId", "status");

-- CreateIndex
CREATE INDEX "advance_repayments_advanceId_idx" ON "advance_repayments"("advanceId");

-- CreateIndex
CREATE INDEX "advance_repayments_payrollRunId_idx" ON "advance_repayments"("payrollRunId");

-- AddForeignKey
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_repayments" ADD CONSTRAINT "advance_repayments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "employee_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_repayments" ADD CONSTRAINT "advance_repayments_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
