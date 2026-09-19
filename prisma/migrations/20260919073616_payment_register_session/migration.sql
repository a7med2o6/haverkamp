-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "registerSessionId" TEXT;

-- CreateIndex
CREATE INDEX "payments_registerSessionId_idx" ON "payments"("registerSessionId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- ربط الدفعات القائمة بورديات قبضها.
--
-- كانت الوردية على الفاتورة، وتحصيلٌ لاحق ينقلها إلى وردية المحصِّل
-- بدفعاتها القديمة كلها. ومن قبض كل دفعة لم يُسجَّل، فلا نخمّنه بالوقت
-- وحده: ورديةٌ تُركت مفتوحة أسابيع تبتلع دفعات غيرها. لكل دفعة:
--   ١. دفعة البيع — قُيِّدت مع الفاتورة في اللحظة نفسها — لوردية البائع
--      (كاشير الفاتورة) التي تشمل وقتها، إن كانت واحدة؛
--   ٢. وإلا — تحصيلٌ لاحق — لوردية الفاتورة الحالية إن شملت وقتها: هي
--      وردية آخر من حصّل، وحيث كان النظام القديم يعدّها أصلاً؛
--   ٣. وإلا تبقى فارغة — الفراغ أصدق من درجٍ خاطئ.
-- الورديات المغلقة تحتفظ بما حُسب ساعة إغلاقها؛ هذا للحساب من الآن.
-- ─────────────────────────────────────────────────────────────
UPDATE "payments" p
SET "registerSessionId" = (
  SELECT s."id" FROM "register_sessions" s
  WHERE s."openedById" = o."cashierId"
    AND p."receivedAt" >= s."openedAt"
    AND p."receivedAt" <= COALESCE(s."closedAt", 'infinity'::timestamp)
)
FROM "orders" o
WHERE p."orderId" = o."id"
  AND o."cashierId" IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (p."receivedAt" - o."createdAt"))) <= 5
  AND (
    SELECT COUNT(*) FROM "register_sessions" s
    WHERE s."openedById" = o."cashierId"
      AND p."receivedAt" >= s."openedAt"
      AND p."receivedAt" <= COALESCE(s."closedAt", 'infinity'::timestamp)
  ) = 1;

UPDATE "payments" p
SET "registerSessionId" = o."registerSessionId"
FROM "orders" o
JOIN "register_sessions" s ON s."id" = o."registerSessionId"
WHERE p."orderId" = o."id"
  AND p."registerSessionId" IS NULL
  AND ABS(EXTRACT(EPOCH FROM (p."receivedAt" - o."createdAt"))) > 5
  AND p."receivedAt" >= s."openedAt"
  AND p."receivedAt" <= COALESCE(s."closedAt", 'infinity'::timestamp);
