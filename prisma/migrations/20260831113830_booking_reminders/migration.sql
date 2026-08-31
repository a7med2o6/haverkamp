-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "confirmToken" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmToken_key" ON "bookings"("confirmToken");

-- CreateIndex
CREATE INDEX "bookings_reminderSentAt_idx" ON "bookings"("reminderSentAt");
