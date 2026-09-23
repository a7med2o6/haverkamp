-- CreateEnum
CREATE TYPE "WashRenewalDecision" AS ENUM ('RENEW', 'DECLINE');

-- AlterTable
ALTER TABLE "wash_subscription_periods" ADD COLUMN     "renewalNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "renewalRemindedAt" TIMESTAMP(3),
ADD COLUMN     "renewalDecision" "WashRenewalDecision",
ADD COLUMN     "renewalDecidedAt" TIMESTAMP(3);
