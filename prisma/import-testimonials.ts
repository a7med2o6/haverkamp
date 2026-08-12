/**
 * ينقل آراء العملاء من مفاتيح الترجمة إلى جدول testimonials.
 * الرئيسية كانت تقرأ الآراء من المفاتيح مباشرة — بعد النقل تُدار من لوحة
 * التحكم، ويبقى الرجوع للمفاتيح نسخة احتياطية إن أُفرغ الجدول بالكامل.
 * التشغيل:  npx tsx prisma/import-testimonials.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** الأسماء والصور كانت ثابتة في home.tsx بينما النصوص في الترجمات */
const PEOPLE = [
  { key: 'testi.1', author: 'عمر السعدون', avatar: '/assets/male-1.png' },
  { key: 'testi.2', author: 'نورة العجمي', avatar: '/assets/female-3.png' },
  { key: 'testi.3', author: 'بدر الرشيدي', avatar: '/assets/male-2.png' },
  { key: 'testi.4', author: 'سارة المطيري', avatar: '/assets/female-3.png' },
  { key: 'testi.5', author: 'فهد العنزي', avatar: '/assets/male-1.png' },
  { key: 'testi.6', author: 'دلال الخالدي', avatar: '/assets/female-3.png' },
  { key: 'testi.7', author: 'خالد الدوسري', avatar: '/assets/male-2.png' },
  { key: 'testi.8', author: 'منيرة الصباح', avatar: '/assets/female-3.png' },
  { key: 'testi.9', author: 'يوسف الحربي', avatar: '/assets/male-1.png' },
];

const ENTITIES: Record<string, string> = {
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&quot;': '"',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&amp;': '&',
};

/** الكيانات كانت تُفكّ في المتصفح عبر innerHTML — نخزّنها مفكوكة */
function decode(s: string): string;
function decode(s: string | null): string | null;
function decode(s: string | null) {
  if (!s) return s;
  return s.replace(
    /&(ldquo|rdquo|lsquo|rsquo|quot|mdash|ndash|hellip|nbsp|amp);/g,
    (m) => ENTITIES[m] ?? m
  );
}

async function main() {
  const existing = await db.testimonial.count();
  if (existing > 0) {
    console.log(`الجدول فيه ${existing} رأي بالفعل — لا شيء لفعله`);
    return;
  }

  const keys = PEOPLE.flatMap((p) => [p.key, `${p.key}.car`]);
  const rows = await db.translation.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  let n = 0;
  for (const [i, p] of PEOPLE.entries()) {
    const body = byKey.get(p.key);
    if (!body) {
      console.warn(`  ⚠ مفتاح ${p.key} غير موجود — تخطّي`);
      continue;
    }
    const car = byKey.get(`${p.key}.car`);

    await db.testimonial.create({
      data: {
        author: p.author,
        avatar: p.avatar,
        rating: 5,
        bodyAr: decode(body.ar),
        bodyEn: decode(body.en),
        carModel: decode(car?.ar ?? null),
        sortOrder: i + 1,
        isActive: true,
      },
    });
    n++;
  }

  console.log(`✔ تم نقل ${n} رأي إلى جدول testimonials`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
