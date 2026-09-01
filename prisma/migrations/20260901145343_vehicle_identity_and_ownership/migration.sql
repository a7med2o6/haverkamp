-- السيارة كيان مستقل: حذف العميل لم يعد يحذف سيارته
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_customerId_fkey";
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- اللوحة هوية السيارة — ثابتة لا تتغيّر، ففريدة حيث وُجدت
DROP INDEX IF EXISTS "vehicles_plateNo_idx";
CREATE UNIQUE INDEX "vehicles_plateNo_key" ON "vehicles"("plateNo");

-- رقم الشاسيه لا يُجمع، فلا يُخزَّن
ALTER TABLE "vehicles" DROP COLUMN "vin";

-- CreateTable
CREATE TABLE "vehicle_ownerships" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "to" TIMESTAMP(3),

    CONSTRAINT "vehicle_ownerships_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_ownerships_vehicleId_idx" ON "vehicle_ownerships"("vehicleId");
CREATE INDEX "vehicle_ownerships_customerId_idx" ON "vehicle_ownerships"("customerId");
ALTER TABLE "vehicle_ownerships" ADD CONSTRAINT "vehicle_ownerships_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_ownerships" ADD CONSTRAINT "vehicle_ownerships_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "customer_phones" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_phones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_phones_phone_idx" ON "customer_phones"("phone");
CREATE INDEX "customer_phones_customerId_idx" ON "customer_phones"("customerId");
ALTER TABLE "customer_phones" ADD CONSTRAINT "customer_phones_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- الكفالة تُنسب لمن دفعها، فلا تنتقل مع السيارة
ALTER TABLE "warranties" ADD COLUMN "customerId" TEXT;
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ملكية أولى لكل سيارة قائمة
INSERT INTO "vehicle_ownerships" ("id", "vehicleId", "customerId", "from")
SELECT gen_random_uuid()::text, "id", "customerId", "createdAt" FROM "vehicles";
