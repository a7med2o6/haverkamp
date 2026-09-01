-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "skills" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warranties" ADD COLUMN     "serviceEveryMonths" INTEGER;

-- CreateTable
CREATE TABLE "vehicle_services" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_services_vehicleId_visitedAt_idx" ON "vehicle_services"("vehicleId", "visitedAt");

-- AddForeignKey
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
