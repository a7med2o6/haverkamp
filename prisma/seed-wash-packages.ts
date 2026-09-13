/**
 * باقات الغسيل — حجم السيارة × نوع الغسيل.
 * التشغيل:  npm run db:seed:wash-packages
 *
 * الأسعار مبدئية وُضعت ليُبدأ العمل، وتُعدَّل من «الباقات والأسعار» في لوحة
 * التحكم. لذلك السكربت يُنشئ ولا يحدّث: إعادة تشغيله لا تمسّ سعراً أو اسماً
 * عُدِّل من اللوحة — وإلا لأعاد الأسعار المبدئية فوق الحقيقية بصمت.
 *
 * والسعر ثابت لا «يبدأ من»: الاشتراك الشهري يُتّفق عليه رقماً واحداً.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SIZES = [
  { key: 'sedan', ar: 'صالون', en: 'Sedan' },
  { key: 'suv', ar: 'دفع رباعي', en: 'SUV' },
] as const;

const TYPES = [
  { key: 'exterior', ar: 'خارجي', en: 'Exterior' },
  { key: 'full', ar: 'خارجي وداخلي', en: 'Exterior & Interior' },
] as const;

/** السعر الشهري المبدئي بالدينار — [الحجم][النوع] */
const PLACEHOLDER_PRICES: Record<(typeof SIZES)[number]['key'], Record<(typeof TYPES)[number]['key'], number>> = {
  sedan: { exterior: 15, full: 25 },
  suv: { exterior: 20, full: 30 },
};

async function main() {
  const service = await db.service.findUnique({ where: { slug: 'wash' } });
  if (!service) throw new Error('خدمة الغسيل (wash) غير موجودة — شغّل البذور الأساسية أولاً');

  let created = 0;
  let kept = 0;
  let order = 0;

  for (const size of SIZES) {
    for (const type of TYPES) {
      order++;
      const id = `pkg-wash-${size.key}-${type.key}`;
      const existing = await db.servicePackage.findUnique({ where: { id }, select: { id: true } });
      if (existing) {
        kept++;
        continue;
      }

      await db.servicePackage.create({
        data: {
          id,
          serviceId: service.id,
          price: PLACEHOLDER_PRICES[size.key][type.key],
          priceFrom: false,
          sortOrder: order,
          isActive: true,
          translations: {
            create: [
              { locale: 'ar', name: `${size.ar} — ${type.ar}`, features: [] },
              { locale: 'en', name: `${size.en} — ${type.en}`, features: [] },
            ],
          },
        },
      });
      created++;
      console.log(`✔ ${id} — ${size.ar} — ${type.ar} — ${PLACEHOLDER_PRICES[size.key][type.key]} د.ك`);
    }
  }

  console.log(`\nأُنشئت ${created} باقة، وبقيت ${kept} قائمةً كما هي.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
