-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "rescheduledAt" TIMESTAMP(3);

-- إعدادات تغيير الموعد الذاتي — قابلة للتحرير من «إعدادات الموقع»
INSERT INTO "site_settings" ("key", "value", "group", "updatedAt") VALUES
  ('bookings.slotCapacity',   '3'::jsonb,  'bookings', NOW()),
  ('bookings.windowDays',     '14'::jsonb, 'bookings', NOW()),
  ('bookings.slotMinutes',    '60'::jsonb, 'bookings', NOW()),
  ('bookings.leadHours',      '3'::jsonb,  'bookings', NOW())
ON CONFLICT ("key") DO NOTHING;
