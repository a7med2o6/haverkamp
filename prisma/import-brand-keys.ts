/**
 * يضيف مفاتيح الترجمة الناقصة لصفحات الماركات (هافركامب/كلايف/أيرون).
 * الأسعار وأرقام الإحصائيات كانت مكتوبة داخل HTML مباشرة، فلم تكن قابلة
 * للتعديل من اللوحة — نقلناها لجدول الترجمات ليملكها صاحب المحل.
 * التشغيل:  npx tsx prisma/import-brand-keys.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Row = { key: string; ar: string; en: string; group: string };

const rows: Row[] = [
  // ── هافركامب ──
  { key: 'hvk.st1.num', ar: '+40', en: '+40', group: 'hvk' },
  { key: 'hvk.st2.num', ar: '9.5μ', en: '9.5μ', group: 'hvk' },
  { key: 'hvk.st3.num', ar: '10 سنوات', en: '10 years', group: 'hvk' },
  { key: 'hvk.pkg1.price', ar: '580', en: '580', group: 'hvk' },
  { key: 'hvk.pkg2.price', ar: '320', en: '320', group: 'hvk' },
  { key: 'hvk.pkg3.price', ar: '230', en: '230', group: 'hvk' },

  // ── كلايف ديزاين ──
  { key: 'clif.st1.num', ar: '9.5μ', en: '9.5μ', group: 'clif' },
  { key: 'clif.st2.num', ar: '10 سنوات', en: '10 years', group: 'clif' },
  { key: 'clif.st3.num', ar: '+70%', en: '+70%', group: 'clif' },
  { key: 'clif.pkg1.price', ar: '500', en: '500', group: 'clif' },
  { key: 'clif.pkg2.price', ar: '250', en: '250', group: 'clif' },
  { key: 'clif.pkg3.price', ar: '175', en: '175', group: 'clif' },

  // ── أيرون شيلد ──
  { key: 'iron.st1.num', ar: '8.7μ', en: '8.7μ', group: 'iron' },
  { key: 'iron.st2.num', ar: '10 سنوات', en: '10 years', group: 'iron' },
  { key: 'iron.st3.num', ar: 'Self-Heal', en: 'Self-Heal', group: 'iron' },
  { key: 'iron.pkg1.price', ar: '400', en: '400', group: 'iron' },
  { key: 'iron.pkg2.price', ar: '210', en: '210', group: 'iron' },
  { key: 'iron.pkg3.price', ar: '160', en: '160', group: 'iron' },
];

async function main() {
  let added = 0;
  for (const r of rows) {
    // لا نلمس مفتاحاً موجوداً — قد يكون صاحب المحل عدّله من اللوحة
    const existing = await db.translation.findUnique({ where: { key: r.key } });
    if (existing) continue;

    await db.translation.create({ data: r });
    added++;
  }

  console.log(`✔ أُضيف ${added} مفتاح (${rows.length - added} موجود مسبقاً)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
