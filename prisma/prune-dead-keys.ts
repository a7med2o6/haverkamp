/**
 * يحذف مفاتيح الترجمة التي لم يعد يقرأها أي شيء.
 *
 * انتقل محتواها إلى جداولها (الخدمات والمنتجات)، فبقاؤها في «نصوص
 * الموقع» فخّ: يعدّلها المحرّر فلا يتغيّر شيء على الموقع.
 *
 * لا يشمل هذا `testi.*` رغم أنها خارج المحرّرات — الصفحة الرئيسية
 * تقرأها احتياطياً حين يخلو جدول الآراء.
 *
 * التشغيل:  npx tsx prisma/prune-dead-keys.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** بادئات ومفاتيح لم يعد لها قارئ */
const DEAD = {
  /** بطاقات الخدمات في الرئيسية — صارت من جدول الخدمات */
  'card.': 'بطاقات الخدمات',
  /** أوصاف منتجات الإكسسوارات — صارت من جدول المنتجات */
  'acc.prod.desc.': 'أوصاف المنتجات',
} as const;

const DEAD_EXACT = {
  'acc.count.perf': 'عدّاد العطور',
  'acc.count.med': 'عدّاد الميداليات',
} as const;

async function main() {
  const targets: { key: string; why: string }[] = [];

  for (const [prefix, why] of Object.entries(DEAD)) {
    const rows = await db.translation.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true },
    });
    targets.push(...rows.map((r) => ({ key: r.key, why })));
  }

  for (const [key, why] of Object.entries(DEAD_EXACT)) {
    const row = await db.translation.findUnique({ where: { key }, select: { key: true } });
    if (row) targets.push({ key: row.key, why });
  }

  if (targets.length === 0) {
    console.log('لا مفاتيح ميتة — لا شيء لحذفه');
    return;
  }

  console.log(`سيُحذف ${targets.length} مفتاحاً:`);
  for (const t of targets) console.log(`  · ${t.key}  (${t.why})`);

  await db.translation.deleteMany({ where: { key: { in: targets.map((t) => t.key) } } });
  console.log(`\n✔ تم حذف ${targets.length} مفتاحاً`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
