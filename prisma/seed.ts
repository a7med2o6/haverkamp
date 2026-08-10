/**
 * البيانات الأولية — التشغيل: npx prisma db seed
 * آمن للتشغيل المتكرر (idempotent).
 */
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── الخدمات (مطابقة لصفحات الموقع القديم) ──────────────────
const SERVICES = [
  {
    slug: 'protication',
    icon: 'ShieldCheck',
    cardImage: '/assets/main-page/protication1.png',
    sortOrder: 1,
    ar: {
      name: 'حماية بدي',
      tagline: 'أفلام حماية بكفالة تصل إلى ١٠ سنوات',
      shortDesc: 'أفلام حماية ألمانية وكورية وأمريكية بكفالة تصل إلى 10 سنوات.',
      metaTitle: 'حماية بدي السيارة PPF في الكويت | هافركامب',
      metaDescription:
        'أفلام حماية بدي السيارة PPF ألمانية وكورية وأمريكية بكفالة تصل إلى 10 سنوات — هافركامب الكويت.',
    },
    en: {
      name: 'Paint Protection Film',
      tagline: 'PPF films with up to 10-year warranty',
      shortDesc: 'German, Korean & American PPF films with up to 10-year warranty.',
      metaTitle: 'Paint Protection Film (PPF) in Kuwait | Haverkamp',
      metaDescription:
        'German, Korean and American paint protection films with warranties up to 10 years — Haverkamp Kuwait.',
    },
  },
  {
    slug: 'haverkamp',
    icon: 'Award',
    cardImage: '/assets/services/haverkamp/haverkamp.png',
    sortOrder: 2,
    showInNav: false,
    ar: {
      name: 'حماية هافركامب الألمانية',
      tagline: 'الوكيل الحصري في الشرق الأوسط',
      shortDesc: 'أفلام الحماية الألمانية الأصلية بأعلى معايير الجودة.',
    },
    en: {
      name: 'Haverkamp German PPF',
      tagline: 'Exclusive distributor in the Middle East',
      shortDesc: 'Original German protection films at the highest quality standards.',
    },
  },
  {
    slug: 'clif',
    icon: 'Layers',
    sortOrder: 3,
    showInNav: false,
    ar: {
      name: 'حماية كلايف ديزاين الكورية',
      tagline: 'الوكيل الحصري بالكويت',
      shortDesc: 'أفلام حماية كورية عالية الجودة بكفالة معتمدة.',
    },
    en: {
      name: 'Clif Design Korean PPF',
      tagline: 'Exclusive distributor in Kuwait',
      shortDesc: 'High-quality Korean protection films with certified warranty.',
    },
  },
  {
    slug: 'iron',
    icon: 'Shield',
    sortOrder: 4,
    showInNav: false,
    ar: {
      name: 'حماية أيرون شيلد الأمريكية',
      tagline: 'حماية أمريكية موثوقة',
      shortDesc: 'أفلام حماية أمريكية بمواصفات عالية.',
    },
    en: {
      name: 'Iron Shield American PPF',
      tagline: 'Trusted American protection',
      shortDesc: 'American protection films with high specifications.',
    },
  },
  {
    slug: 'tint',
    icon: 'Sun',
    cardImage: '/assets/main-page/tint.png',
    sortOrder: 5,
    ar: {
      name: 'عازل حراري',
      tagline: 'كفالة تصل إلى ٥ سنوات',
      shortDesc: 'عوازل حرارية ألمانية وأمريكية بكفالة تصل إلى 5 سنوات.',
      metaTitle: 'عازل حراري وتظليل سيارات في الكويت | هافركامب',
      metaDescription: 'عوازل حرارية ألمانية وأمريكية بكفالة تصل إلى 5 سنوات — هافركامب الكويت.',
    },
    en: {
      name: 'Window Tinting',
      tagline: 'Up to 5-year warranty',
      shortDesc: 'German & American window tints with up to 5-year warranty.',
      metaTitle: 'Car Window Tinting in Kuwait | Haverkamp',
      metaDescription: 'German and American heat-rejection window films with up to 5-year warranty.',
    },
  },
  {
    slug: 'paint',
    icon: 'Paintbrush',
    cardImage: '/assets/main-page/painting.jpg',
    sortOrder: 6,
    ar: {
      name: 'صبغ',
      tagline: 'صبغ وحدادة بأحدث التقنيات',
      shortDesc: 'صبغ سيارات وحدادة وإصلاح خدوش ودعمات بأحدث التقنيات.',
    },
    en: {
      name: 'Paint & Body',
      tagline: 'Painting and bodywork with the latest techniques',
      shortDesc: 'Car painting, bodywork & scratch removal using the latest techniques.',
    },
  },
  {
    slug: 'glass',
    icon: 'Sparkle',
    cardImage: '/assets/main-page/glass.png',
    sortOrder: 7,
    ar: {
      name: 'إصلاح الجام',
      tagline: 'إصلاح وتبديل زجاج السيارات',
      shortDesc: 'إصلاح شروخ وكسور زجاج السيارة وتبديل الجام بخامات أصلية.',
    },
    en: {
      name: 'Glass Repair',
      tagline: 'Windshield repair and replacement',
      shortDesc: 'Windshield chip & crack repair and full glass replacement with genuine parts.',
    },
  },
  {
    slug: 'polish',
    icon: 'Wand2',
    cardImage: '/assets/main-page/polishing.png',
    sortOrder: 8,
    ar: {
      name: 'بوليش',
      tagline: 'تلميع بمواد ألمانية',
      shortDesc: 'بوليش وتلميع خارجي بمواد ألمانية يعيد لمعان سيارتك.',
    },
    en: {
      name: 'Polishing',
      tagline: 'Buffing with German materials',
      shortDesc: "Exterior polish & buffing with German materials to restore your car's shine.",
    },
  },
  {
    slug: 'wash',
    icon: 'Droplets',
    cardImage: '/assets/main-page/wash.png',
    sortOrder: 9,
    ar: {
      name: 'غسيل',
      tagline: 'غسيل وعناية متنقلة',
      shortDesc: 'غسيل وتنظيف داخلي وعناية كاملة بسيارتك.',
    },
    en: {
      name: 'Car Wash',
      tagline: 'Mobile wash and care',
      shortDesc: 'Full interior & exterior wash and complete car care.',
    },
  },
  {
    slug: 'accessories',
    icon: 'ShoppingBag',
    sortOrder: 10,
    ar: {
      name: 'اكسسوارات',
      tagline: 'عطور ومستلزمات سيارتك',
      shortDesc: 'اكسسوارات وعطور ومستلزمات لسيارتك.',
    },
    en: {
      name: 'Accessories',
      tagline: 'Fragrances and car essentials',
      shortDesc: 'Car accessories, fragrances & essentials.',
    },
  },
] as const;

const SITE_SETTINGS: Array<{ key: string; value: unknown; group: string }> = [
  { key: 'site.name.ar', value: 'هافركامب الكويت', group: 'general' },
  { key: 'site.name.en', value: 'Haverkamp Kuwait', group: 'general' },
  { key: 'site.url', value: 'https://haverkampkw.com', group: 'general' },
  { key: 'contact.whatsapp', value: '96551111154', group: 'contact' },
  { key: 'contact.phone', value: '+965 5111 1154', group: 'contact' },
  { key: 'contact.address.ar', value: 'الري – قطعة 1 – شارع 19، الكويت', group: 'contact' },
  { key: 'contact.address.en', value: 'Rai – Block 1 – Street 19, Kuwait', group: 'contact' },
  { key: 'contact.hours.ar', value: 'السبت – الخميس · 10 ص — 8 م', group: 'contact' },
  { key: 'contact.hours.en', value: 'Sat – Thu · 10 AM — 8 PM', group: 'contact' },
  { key: 'contact.geo', value: { lat: 29.3092865, lng: 47.9444435 }, group: 'contact' },
  { key: 'social.instagram', value: 'https://instagram.com/haverkampkw', group: 'social' },
  { key: 'stats.years', value: 14, group: 'stats' },
  { key: 'stats.clients', value: 5000, group: 'stats' },
  { key: 'stats.cars', value: 3200, group: 'stats' },
  { key: 'tracking.googleAds', value: 'AW-16636917037', group: 'tracking' },
  { key: 'pos.taxRate', value: 0, group: 'pos' },
  { key: 'pos.receiptFooter.ar', value: 'شكراً لثقتكم بهافركامب', group: 'pos' },
  { key: 'hr.workDayStart', value: '10:00', group: 'hr' },
  { key: 'hr.workDayEnd', value: '20:00', group: 'hr' },
  { key: 'hr.lateGraceMins', value: 15, group: 'hr' },
  { key: 'hr.weekend', value: ['FRI'], group: 'hr' },
  // الغياب في هذه الأيام يُخصم بيومين — الخميس والسبت يحيطان بعطلة الجمعة
  { key: 'hr.doubleDeductionDays', value: ['THU', 'SAT'], group: 'hr' },
  // أنواع الإجازات التي تُخصم من الراتب — البقية مدفوعة
  { key: 'hr.unpaidLeaveTypes', value: ['UNPAID'], group: 'hr' },
];

const DEPARTMENTS = [
  { nameAr: 'الإدارة', nameEn: 'Management' },
  { nameAr: 'ورشة الحماية', nameEn: 'PPF Workshop' },
  { nameAr: 'ورشة الصبغ', nameEn: 'Paint Shop' },
  { nameAr: 'العازل الحراري', nameEn: 'Tinting' },
  { nameAr: 'الغسيل والتلميع', nameEn: 'Wash & Polish' },
  { nameAr: 'الاستقبال والمبيعات', nameEn: 'Reception & Sales' },
  { nameAr: 'المحاسبة', nameEn: 'Accounting' },
];

const PRODUCT_CATEGORIES = [
  { nameAr: 'أفلام حماية', nameEn: 'PPF Films', sortOrder: 1 },
  { nameAr: 'عوازل حرارية', nameEn: 'Tint Films', sortOrder: 2 },
  { nameAr: 'مواد صبغ', nameEn: 'Paint Materials', sortOrder: 3 },
  { nameAr: 'مواد تلميع', nameEn: 'Polish Materials', sortOrder: 4 },
  { nameAr: 'عطور', nameEn: 'Fragrances', sortOrder: 5 },
  { nameAr: 'ميداليات', nameEn: 'Keychains', sortOrder: 6 },
  { nameAr: 'إكسسوارات متنوعة', nameEn: 'Misc Accessories', sortOrder: 7 },
];

async function seedUsers() {
  const password = process.env.SEED_ADMIN_PASSWORD || 'Haverkamp@2026';
  const hash = await bcrypt.hash(password, 12);

  const owner = await db.user.upsert({
    where: { email: 'admin@haverkampkw.com' },
    update: {},
    create: {
      email: 'admin@haverkampkw.com',
      passwordHash: hash,
      name: 'مدير النظام',
      role: 'OWNER',
    },
  });

  console.log(`  ✔ المستخدم: ${owner.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`    كلمة المرور الافتراضية: ${password}  ← غيّرها بعد أول دخول`);
  }
}

async function seedServices() {
  for (const s of SERVICES) {
    const service = await db.service.upsert({
      where: { slug: s.slug },
      update: {
        icon: s.icon,
        cardImage: 'cardImage' in s ? s.cardImage : null,
        sortOrder: s.sortOrder,
        showInNav: 'showInNav' in s ? s.showInNav : true,
      },
      create: {
        slug: s.slug,
        icon: s.icon,
        cardImage: 'cardImage' in s ? s.cardImage : null,
        sortOrder: s.sortOrder,
        showInNav: 'showInNav' in s ? s.showInNav : true,
      },
    });

    for (const locale of ['ar', 'en'] as const) {
      const t = s[locale];
      await db.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: service.id, locale } },
        update: t,
        create: { serviceId: service.id, locale, ...t },
      });
    }
  }
  console.log(`  ✔ الخدمات: ${SERVICES.length}`);
}

async function seedSettings() {
  for (const s of SITE_SETTINGS) {
    await db.siteSetting.upsert({
      where: { key: s.key },
      update: { value: s.value as never, group: s.group },
      create: { key: s.key, value: s.value as never, group: s.group },
    });
  }
  console.log(`  ✔ الإعدادات: ${SITE_SETTINGS.length}`);
}

async function seedLookups() {
  for (const d of DEPARTMENTS) {
    const exists = await db.department.findFirst({ where: { nameAr: d.nameAr } });
    if (!exists) await db.department.create({ data: d });
  }
  console.log(`  ✔ الأقسام: ${DEPARTMENTS.length}`);

  for (const c of PRODUCT_CATEGORIES) {
    const exists = await db.productCategory.findFirst({ where: { nameAr: c.nameAr } });
    if (!exists) await db.productCategory.create({ data: c });
  }
  console.log(`  ✔ تصنيفات المنتجات: ${PRODUCT_CATEGORIES.length}`);
}

async function seedPages() {
  const terms = await db.page.upsert({
    where: { slug: 'terms' },
    update: {},
    create: { slug: 'terms' },
  });

  await db.pageTranslation.upsert({
    where: { pageId_locale: { pageId: terms.id, locale: 'ar' } },
    update: {},
    create: {
      pageId: terms.id,
      locale: 'ar',
      title: 'البنود والشروط',
      body: '## البنود والشروط\n\nيُرجى تحديث هذا المحتوى من لوحة التحكم.',
      metaTitle: 'البنود والشروط | هافركامب الكويت',
    },
  });

  await db.pageTranslation.upsert({
    where: { pageId_locale: { pageId: terms.id, locale: 'en' } },
    update: {},
    create: {
      pageId: terms.id,
      locale: 'en',
      title: 'Terms & Conditions',
      body: '## Terms & Conditions\n\nPlease update this content from the dashboard.',
      metaTitle: 'Terms & Conditions | Haverkamp Kuwait',
    },
  });

  console.log('  ✔ الصفحات الثابتة');
}

async function main() {
  console.log('▶ بدء تعبئة البيانات الأولية…');
  await seedUsers();
  await seedServices();
  await seedSettings();
  await seedLookups();
  await seedPages();
  console.log('✔ اكتملت التعبئة.');
}

main()
  .catch((e) => {
    console.error('✘ فشلت التعبئة:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
