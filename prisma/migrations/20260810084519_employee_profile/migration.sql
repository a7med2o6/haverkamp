-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'WORK_PERMIT';
ALTER TYPE "DocumentType" ADD VALUE 'RESIDENCY_APPLICATION';
ALTER TYPE "DocumentType" ADD VALUE 'INSURANCE';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "sponsor" TEXT;
