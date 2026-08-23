/**
 * باقات الحماية الخمس × ثلاث باقات لكل ماركة.
 * التشغيل:  npx tsx prisma/seed-protection-packages.ts
 *
 * السكربت آمن للتكرار — يستعمل معرّفات ثابتة ويحدّث القائم بدل تكراره.
 * الأسعار «تبدأ من» لأن السعر النهائي متغيّر حسب نوع السيارة.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** الباقات الثلاث ومحتوياتها — واحدة لكل الماركات */
const TIERS = [
  {
    key: 'full',
    ar: 'فل بدي',
    en: 'Full Body',
    features: [
      'حماية فل بدي باستثناء السقف',
      'عازل حراري',
      'حماية جام',
      'نانو سيراميك للمقاعد',
      'نانو سيراميك للرنقات',
      'تلبيس للدواسات',
    ],
    featuresEn: [
      'Full body protection excluding the roof',
      'Window tinting',
      'Glass protection',
      'Nano ceramic for seats',
      'Nano ceramic for rims',
      'Pedal covers',
    ],
  },
  {
    key: 'hood',
    ar: 'كبوت كامل',
    en: 'Full Hood',
    features: ['حماية الكبوت بالكامل', 'عازل حراري', 'حماية جام'],
    featuresEn: ['Full hood protection', 'Window tinting', 'Glass protection'],
  },
  {
    key: 'half',
    ar: 'نص كبوت',
    en: 'Half Hood',
    features: ['حماية نصف الكبوت', 'عازل حراري'],
    featuresEn: ['Half hood protection', 'Window tinting'],
  },
] as const;

/**
 * الماركات وأسعارها بالترتيب: فل بدي · كبوت كامل · نص كبوت.
 * أسعار اكس بل وهكسيس صفر مؤقتاً — تُملأ من اللوحة لاحقاً.
 */
const BRANDS = [
  { slug: 'haverkamp', prices: [580, 320, 230] },
  { slug: 'clif', prices: [500, 250, 175] },
  { slug: 'iron', prices: [400, 210, 160] },
  { slug: 'xpel', prices: [0, 0, 0] },
  { slug: 'hexis', prices: [0, 0, 0] },
] as const;

/** ماركات داخلية بلا صفحات على الموقع — showInNav=false ولا سجلّ في MIGRATED_SERVICES */
const NEW_SERVICES = [
  {
    slug: 'xpel',
    icon: 'Shield',
    sortOrder: 11,
    ar: 'حماية اكس بل الأمريكية',
    en: 'XPEL American Protection',
  },
  {
    slug: 'hexis',
    icon: 'Shield',
    sortOrder: 12,
    ar: 'حماية هكسيس الفرنسية',
    en: 'Hexis French Protection',
  },
];

async function main() {
  for (const s of NEW_SERVICES) {
    const service = await db.service.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, icon: s.icon, sortOrder: s.sortOrder, isActive: true, showInNav: false },
      update: {},
    });

    for (const [locale, name] of [['ar', s.ar], ['en', s.en]] as const) {
      await db.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: service.id, locale } },
        create: { serviceId: service.id, locale, name },
        update: { name },
      });
    }

    console.log(`✔ خدمة ${s.slug} — ${s.ar}`);
  }

  for (const brand of BRANDS) {
    const service = await db.service.findUnique({ where: { slug: brand.slug } });
    if (!service) {
      console.warn(`⚠ تخطّي ${brand.slug} — الخدمة غير موجودة`);
      continue;
    }

    for (const [i, tier] of TIERS.entries()) {
      const id = `pkg-${brand.slug}-${tier.key}`;
      const price = brand.prices[i];

      await db.servicePackage.upsert({
        where: { id },
        create: {
          id,
          serviceId: service.id,
          price,
          priceFrom: true,
          sortOrder: i + 1,
          isActive: true,
          isPopular: i === 0,
        },
        update: { serviceId: service.id, price, priceFrom: true, sortOrder: i + 1 },
      });

      for (const [locale, name, features] of [
        ['ar', tier.ar, tier.features],
        ['en', tier.en, tier.featuresEn],
      ] as const) {
        await db.servicePackageTranslation.upsert({
          where: { packageId_locale: { packageId: id, locale } },
          create: { packageId: id, locale, name, features: [...features] },
          update: { name, features: [...features] },
        });
      }
    }

    console.log(`✔ باقات ${brand.slug} — ${brand.prices.join(' / ')}`);
  }

  await db.$disconnect();
}

main();
