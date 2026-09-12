-- CreateEnum
CREATE TYPE "WashSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "WashPeriodStatus" AS ENUM ('DUE', 'ELIGIBLE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WashVisitStatus" AS ENUM ('BLOCKED', 'PLANNED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WashSkipReason" AS ENUM ('UNPAID', 'CAR_ABSENT', 'CUSTOMER_TRAVEL', 'WEATHER', 'HOLIDAY', 'OPERATIONAL', 'OTHER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WASHER';

-- AlterEnum
ALTER TYPE "OrderChannel" ADD VALUE 'SUBSCRIPTION';

-- CreateTable
CREATE TABLE "wash_subscriptions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "servicePackageId" TEXT,
    "monthlyPrice" DECIMAL(12,3) NOT NULL,
    "area" TEXT NOT NULL,
    "block" TEXT,
    "street" TEXT,
    "building" TEXT,
    "locationNotes" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "WashSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wash_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_subscription_periods" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "priceSnapshot" DECIMAL(12,3) NOT NULL,
    "orderId" TEXT,
    "status" "WashPeriodStatus" NOT NULL DEFAULT 'DUE',
    "eligibleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_subscription_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_visits" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "status" "WashVisitStatus" NOT NULL DEFAULT 'BLOCKED',
    "skipReason" "WashSkipReason",
    "assignedEmployeeId" TEXT,
    "completedByEmployeeId" TEXT,
    "completedAt" TIMESTAMP(3),
    "recordedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_pauses" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wash_subscriptions_code_key" ON "wash_subscriptions"("code");

-- CreateIndex
CREATE INDEX "wash_subscriptions_customerId_idx" ON "wash_subscriptions"("customerId");

-- CreateIndex
CREATE INDEX "wash_subscriptions_vehicleId_idx" ON "wash_subscriptions"("vehicleId");

-- لا يمنع عقداً جديداً بعد انتهاء السابق؛ يمنع فقط عقدين غير منتهيين للسيارة نفسها
CREATE UNIQUE INDEX "wash_subscriptions_vehicle_active_key" ON "wash_subscriptions"("vehicleId") WHERE "status" <> 'ENDED';

-- CreateIndex
CREATE INDEX "wash_subscriptions_area_status_idx" ON "wash_subscriptions"("area", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wash_subscription_periods_orderId_key" ON "wash_subscription_periods"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "wash_subscription_periods_subscriptionId_year_month_key" ON "wash_subscription_periods"("subscriptionId", "year", "month");

-- CreateIndex
CREATE INDEX "wash_visits_scheduledDate_status_idx" ON "wash_visits"("scheduledDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wash_visits_periodId_dueDate_key" ON "wash_visits"("periodId", "dueDate");

-- AddForeignKey
ALTER TABLE "wash_subscriptions" ADD CONSTRAINT "wash_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_subscriptions" ADD CONSTRAINT "wash_subscriptions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_subscriptions" ADD CONSTRAINT "wash_subscriptions_servicePackageId_fkey" FOREIGN KEY ("servicePackageId") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_subscription_periods" ADD CONSTRAINT "wash_subscription_periods_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "wash_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_subscription_periods" ADD CONSTRAINT "wash_subscription_periods_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_visits" ADD CONSTRAINT "wash_visits_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "wash_subscription_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_visits" ADD CONSTRAINT "wash_visits_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_visits" ADD CONSTRAINT "wash_visits_completedByEmployeeId_fkey" FOREIGN KEY ("completedByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_visits" ADD CONSTRAINT "wash_visits_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_pauses" ADD CONSTRAINT "wash_pauses_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "wash_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_pauses" ADD CONSTRAINT "wash_pauses_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
