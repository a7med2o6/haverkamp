-- CreateEnum
CREATE TYPE "CustomerNoteType" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'VISIT', 'COMPLAINT', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" "CustomerNoteType" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_notes_customerId_createdAt_idx" ON "customer_notes"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_notes_followUpAt_idx" ON "customer_notes"("followUpAt");

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
