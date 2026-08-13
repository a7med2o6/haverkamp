/**
 * ينقل منتجات صفحة الإكسسوارات من HTML إلى جدول المنتجات.
 * الأسماء والأسعار والصور كانت مكتوبة في accessories.html، فلم تكن
 * قابلة للتعديل من اللوحة ولا مرتبطة بالمخزون أو نقطة البيع.
 * التشغيل:  npx tsx prisma/import-accessories.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Item = {
  sku: string;
  nameAr: string;
  nameEn: string;
  image: string;
  price: number;
  category: string;
  description: string;
};

const PERFUMES: Item[] = [
  ['H 1', 'h1'],
  ['H 2', 'h2'],
  ['H 3', 'h3'],
  ['H 4', 'h4'],
  ['Unique', 'unique'],
  ['Universal', 'universal'],
  ['Dr. Marcus — Senso Wood', 'drmarcus-senso'],
  ['Dr. Marcus', 'drmarcus'],
].map(([name, file], i) => ({
  sku: `HK-ACC-P${String(i + 1).padStart(2, '0')}`,
  nameAr: name,
  nameEn: name,
  image: `/assets/accessories/perfume/${file}.png`,
  price: 1.5,
  category: 'عطور',
  description: 'عطر سيارة فاخر بعبق مميز',
}));

const MEDALS: Item[] = Array.from({ length: 6 }, (_, i) => ({
  sku: `HK-ACC-M${String(i + 1).padStart(2, '0')}`,
  nameAr: `ميدالية ${i + 1}`,
  nameEn: `Keychain ${i + 1}`,
  image: `/assets/accessories/medal/medal-${i + 1}.png`,
  price: 3,
  category: 'ميداليات',
  description: '',
}));

const LEATHER: Item[] = Array.from({ length: 6 }, (_, i) => ({
  sku: `HK-ACC-L${String(i + 1).padStart(2, '0')}`,
  nameAr: `ميدالية جلد ${i + 1}`,
  nameEn: `Leather keychain ${i + 1}`,
  image: `/assets/accessories/leather_medal/${i + 1}.png`,
  price: 3,
  category: 'ميداليات جلد',
  description: '',
}));

async function main() {
  const items = [...PERFUMES, ...MEDALS, ...LEATHER];

  // الفئات الثلاث تُرتَّب كما تظهر على الصفحة
  const categoryIds = new Map<string, string>();
  for (const [i, name] of ['عطور', 'ميداليات', 'ميداليات جلد'].entries()) {
    const existing = await db.productCategory.findFirst({ where: { nameAr: name } });
    if (existing) {
      categoryIds.set(name, existing.id);
      continue;
    }
    const created = await db.productCategory.create({
      data: { nameAr: name, sortOrder: i + 1 },
    });
    categoryIds.set(name, created.id);
  }

  let added = 0;
  let updated = 0;
  for (const item of items) {
    const data = {
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      image: item.image,
      price: item.price,
      description: item.description || null,
      categoryId: categoryIds.get(item.category) ?? null,
      // الإكسسوارات تُباع بالقطعة ولا نتتبّع كميتها بعد — المخزون لاحقاً
      trackStock: false,
      isActive: true,
      showOnline: true,
    };

    const existing = await db.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      await db.product.update({ where: { sku: item.sku }, data });
      updated++;
    } else {
      await db.product.create({ data: { sku: item.sku, ...data } });
      added++;
    }
  }

  console.log(`✔ ${added} منتج جديد، ${updated} محدَّث — الإجمالي ${items.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
