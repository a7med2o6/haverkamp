-- تعبئة التوكن للحجوزات القائمة قبل إلزامه
UPDATE "bookings"
   SET "confirmToken" = gen_random_uuid()::text
 WHERE "confirmToken" IS NULL;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "confirmToken" SET NOT NULL;
