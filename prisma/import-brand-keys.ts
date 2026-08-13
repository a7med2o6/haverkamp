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

  // ── العازل الحراري: درجات التظليل وأرقام الكفالة ──
  { key: 'tint.l1.pct', ar: 'شفاف', en: 'Clear', group: 'tint' },
  { key: 'tint.l2.pct', ar: '10%', en: '10%', group: 'tint' },
  { key: 'tint.l3.pct', ar: '30%', en: '30%', group: 'tint' },
  { key: 'tint.l4.pct', ar: '50%', en: '50%', group: 'tint' },
  { key: 'tint.w1.num', ar: '99%+', en: '99%+', group: 'tint' },
  { key: 'tint.w2.num', ar: '5', en: '5', group: 'tint' },
  { key: 'tint.w3.num', ar: '50%', en: '50%', group: 'tint' },

  // ── الغسيل: أسعار الباقات وأسماء أصحاب الآراء ──
  { key: 'wash.pkg1.price', ar: '25', en: '25', group: 'wash' },
  { key: 'wash.pkg2.price', ar: '15', en: '15', group: 'wash' },
  { key: 'wash.pkg3.price', ar: '8', en: '8', group: 'wash' },
  { key: 'wash.rev.1.name', ar: 'عمر السعدون', en: 'Omar Al-Saadoun', group: 'wash' },
  { key: 'wash.rev.2.name', ar: 'لطيفة الياسين', en: 'Latifa Al-Yaseen', group: 'wash' },
  { key: 'wash.rev.3.name', ar: 'خالد الفلكاوي', en: 'Khalid Al-Falakawi', group: 'wash' },
  { key: 'wash.rev.4.name', ar: 'إبراهيم القحطاني', en: 'Ibrahim Al-Qahtani', group: 'wash' },
  { key: 'wash.rev.5.name', ar: 'مريم العنبي', en: 'Mariam Al-Anbi', group: 'wash' },
  { key: 'wash.rev.6.name', ar: 'فهد السهلي', en: 'Fahad Al-Sahli', group: 'wash' },

  // ── صفحة التواصل: حالة الفتح كانت مكتوبة داخل سكربت الصفحة ──
  { key: 'cus.open.now', ar: 'مفتوح الآن', en: 'Open Now', group: 'cus' },
  { key: 'cus.closed.now', ar: 'مغلق', en: 'Closed', group: 'cus' },
  { key: 'cus.opens.in', ar: 'يفتح بعد {h} ساعات', en: 'Opens in {h} hours', group: 'cus' },
  { key: 'cus.opens.on', ar: 'يفتح {d}', en: 'Opens {d}', group: 'cus' },

  // ── المتجر: العدد صار يُحسب من جدول المنتجات فنحتاج وحدة العدّ فقط ──
  { key: 'acc.count.unit', ar: 'منتج', en: 'items', group: 'acc' },
  { key: 'acc.cat.other', ar: 'منتجات أخرى', en: 'Other products', group: 'acc' },
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
