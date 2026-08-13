import { cache } from 'react';
import { db } from '@/lib/db';
import { GALLERY_SLOTS } from '@/lib/constants';

export type Locale = 'ar' | 'en';

export const LOCALES: Locale[] = ['ar', 'en'];

/**
 * كيانات HTML للمحارف المطبعية الموروثة من الموقع الثابت.
 * كان يعرضها عبر innerHTML فتُفكّ تلقائياً، أما React فيعرض النص حرفياً —
 * لذا نفكّها عند القراءة. لا نفكّ &lt; و &gt; عمداً حتى لا يتحوّل نصٌّ
 * مهروب إلى وسوم فعلية عند تمريره لعرض HTML.
 */
const ENTITIES: Record<string, string> = {
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&quot;': '"',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&amp;': '&',
};

function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m] ?? m);
}

/**
 * قاموس الترجمة من قاعدة البيانات.
 * `cache` يمنع تكرار الاستعلام بين مكوّنات نفس الطلب.
 */
export const getDictionary = cache(async (locale: Locale) => {
  const rows = await db.translation.findMany({
    select: { key: true, ar: true, en: true },
  });

  const dict = new Map<string, string>();
  for (const row of rows) {
    // الإنجليزية غير المترجَمة ترجع للعربية بدل أن تظهر فارغة
    const value = (locale === 'en' ? row.en || row.ar : row.ar) ?? '';
    dict.set(row.key, decodeEntities(value));
  }

  /** يعيد نص المفتاح، أو المفتاح نفسه إن لم يوجد ليسهل رصد النقص */
  return function t(key: string, fallback = ''): string {
    return dict.get(key) ?? fallback ?? key;
  };
});

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

/** إعدادات الموقع كخريطة مفتاح ← قيمة */
export const getSettings = cache(async () => {
  const rows = await db.siteSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return function setting<T = string>(key: string, fallback?: T): T {
    const value = map.get(key);
    return (value ?? fallback) as T;
  };
});

/** الخدمات المعروضة في شبكة الصفحة الرئيسية */
export const getNavServices = cache(async (locale: Locale) => {
  const services = await db.service.findMany({
    where: { isActive: true, showInNav: true },
    orderBy: { sortOrder: 'asc' },
    include: { translations: { where: { locale } } },
  });

  return services.map((s) => ({
    slug: s.slug,
    cardImage: s.cardImage,
    name: s.translations[0]?.name ?? s.slug,
    shortDesc: s.translations[0]?.shortDesc ?? '',
  }));
});

/* ── صفحات الخدمات ──────────────────────────────────────────
   الصفحات المنقولة إلى Next حتى الآن. لكلٍّ منها بادئة مفاتيح ترجمة
   (تختلف عن الـ slug أحياناً) وامتداد صورها.
   الخدمات غير المدرجة هنا ما زالت تُخدَم من صفحاتها الثابتة في public/
   لأن لها أقساماً خاصة (مستويات العزل، الماركات، الباقات) لم تُبنَ بعد. */
export const MIGRATED_SERVICES: Record<
  string,
  { prefix: string; ext: string; steps: number; features: number; faqs: number }
> = {
  glass: { prefix: 'glass', ext: 'png', steps: 4, features: 4, faqs: 5 },
  polish: { prefix: 'polish', ext: 'png', steps: 4, features: 4, faqs: 5 },
  paint: { prefix: 'paint', ext: 'png', steps: 5, features: 4, faqs: 5 },
};

export type ServicePage = NonNullable<Awaited<ReturnType<typeof getServicePage>>>;

/** يجمّع محتوى صفحة خدمة من الترجمات والأصول */
export const getServicePage = cache(async (slug: string, locale: Locale) => {
  const config = MIGRATED_SERVICES[slug];
  if (!config) return null;

  const [t, service] = await Promise.all([
    getDictionary(locale),
    db.service.findUnique({
      where: { slug },
      include: { translations: { where: { locale } } },
    }),
  ]);

  if (!service || !service.isActive) return null;

  const p = config.prefix;
  const list = (count: number, key: (n: number) => string) =>
    Array.from({ length: count }, (_, i) => key(i + 1));

  return {
    slug,
    name: service.translations[0]?.name ?? slug,
    metaTitle: service.translations[0]?.metaTitle,
    metaDescription: service.translations[0]?.metaDescription,

    hero: {
      tag: t(`${p}.hero.tag`),
      h1: t(`${p}.hero.h1`),
      sub: t(`${p}.hero.sub`),
      body: t(`${p}.hero.p`),
      image: `/assets/services/${slug}/${slug}-hero.${config.ext}`,
      badges: [t(`${p}.tb1`), t(`${p}.tb2`), t(`${p}.tb3`)].filter(Boolean),
    },

    steps: {
      tag: t(`${p}.proc.tag`),
      h2: t(`${p}.proc.h2`),
      body: t(`${p}.proc.p`),
      items: list(config.steps, (n) => `s${n}`).map((k, i) => ({
        num: String(i + 1).padStart(2, '0'),
        title: t(`${p}.${k}.h3`),
        body: t(`${p}.${k}.p`),
      })),
    },

    features: {
      tag: t(`${p}.why.tag`),
      h2: t(`${p}.why.h2`),
      body: t(`${p}.why.p`),
      items: list(config.features, (n) => `w${n}`).map((k, i) => ({
        num: String(i + 1).padStart(2, '0'),
        title: t(`${p}.${k}.h3`),
        body: t(`${p}.${k}.p`),
      })),
    },

    gallery: {
      tag: t(`${p}.gal.tag`),
      h2: t(`${p}.gal.h2`),
      body: t(`${p}.gal.p`),
      images: Array.from(
        { length: 6 },
        (_, i) => `/assets/services/${slug}/${slug}-gal-${i + 1}.${config.ext}`
      ),
    },

    faq: {
      tag: t(`${p}.faq.tag`),
      h2: t(`${p}.faq.h2`),
      items: list(config.faqs, (n) => String(n)).map((n) => ({
        q: t(`${p}.faq.${n}.q`),
        a: t(`${p}.faq.${n}.a`),
      })),
    },

    cta: {
      h2: t(`${p}.cta.h2`),
      body: t(`${p}.cta.p`),
      book: t(`${p}.cta.book`),
    },
  };
});

/* ═══════════════════ صفحات الماركات ═══════════════════ */

interface BrandConfig {
  /** بادئة مفاتيح الترجمة */
  prefix: string;
  /** شعار الماركة في بطاقة البطل */
  logo: string;
  flag: string;
  /** شعار هافركامب صورة على خلفية بيضاء — يحتاج مزج ليختفي الإطار */
  blendLogo?: boolean;
  /** بطاقات «أنواع الحماية» — هافركامب لا تعرضها */
  finish?: { image: string }[];
  gallery: string[];
  /** كلايف تعرض السعر بوحدة نصية بدل «د.ك» وبتصميم بطاقة مختلف */
  packageStyle: 'tier' | 'head';
  tiers: string[];
  /** عدد بنود كل باقة — البلاتينية أطول */
  packageFeatures: string[][];
}

const MAIN_GALLERY = Array.from(
  { length: 6 },
  (_, i) => `/assets/services/main/pro-${i + 1}.webp`
);

export const MIGRATED_BRANDS: Record<string, BrandConfig> = {
  haverkamp: {
    prefix: 'hvk',
    logo: '/assets/services/haverkamp/haverkamp.png',
    flag: '🇩🇪',
    blendLogo: true,
    gallery: Array.from(
      { length: 6 },
      (_, i) => `/assets/services/haverkamp/gallery/g${i + 1}.webp`
    ),
    packageStyle: 'tier',
    tiers: ['PLATINUM', 'GOLD', 'SILVER'],
    packageFeatures: [
      [
        'p1f1',
        'pkg.feat.tint',
        'pkg.feat.ws',
        'pkg.feat.nano.seats',
        'pkg.feat.nano.rims',
        'p1f6',
        'pkg.feat.san',
        'p1f8',
      ],
      ['p2f1', 'pkg.feat.tint', 'pkg.feat.ws', 'pkg.feat.nano.seats', 'pkg.feat.nano.rims', 'pkg.feat.san'],
      ['p3f1', 'pkg.feat.tint', 'pkg.feat.ws', 'pkg.feat.nano.seats', 'pkg.feat.nano.rims', 'pkg.feat.san'],
    ],
  },

  clif: {
    prefix: 'clif',
    logo: '/assets/services/clif/clif-logo.jpg',
    flag: '🇰🇷',
    finish: [
      { image: '/assets/services/body-protection/lam3a-1.jpg' },
      { image: '/assets/services/body-protection/mate.png' },
      { image: '/assets/services/body-protection/color.jpg' },
    ],
    gallery: MAIN_GALLERY,
    packageStyle: 'head',
    tiers: [],
    packageFeatures: [
      ['p1f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'p1f6', 'feat.san', 'p1f8'],
      ['p2f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'feat.san'],
      ['p3f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'feat.san'],
    ],
  },

  iron: {
    prefix: 'iron',
    logo: '/assets/services/iron/iron.png',
    flag: '🇺🇸',
    finish: [
      { image: '/assets/services/body-protection/lam3a-1.jpg' },
      { image: '/assets/services/body-protection/mate.png' },
      { image: '/assets/services/body-protection/color.jpg' },
    ],
    gallery: MAIN_GALLERY,
    packageStyle: 'tier',
    tiers: ['PLATINUM', 'GOLD', 'SILVER'],
    packageFeatures: [
      ['p1f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'p1f6', 'feat.san', 'p1f8'],
      ['p2f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'feat.san'],
      ['p3f1', 'feat.tint', 'feat.ws', 'feat.nano.seats', 'feat.nano.rims', 'feat.san'],
    ],
  },
};

export type BrandPage = NonNullable<Awaited<ReturnType<typeof getBrandPage>>>;

/**
 * كل مسارات الموقع التي يُصيّرها Next — تُبطَل عند تعديل المحتوى.
 * أي صفحة جديدة تُنقل من legacy تُضاف هنا وإلا بقيت تعرض نسخة قديمة.
 */
export function migratedPaths(): string[] {
  const slugs = [...Object.keys(MIGRATED_SERVICES), ...Object.keys(MIGRATED_BRANDS)];
  return [
    '/',
    '/en',
    '/terms.html',
    '/en/terms.html',
    ...slugs.map((s) => `/${s}.html`),
    ...slugs.map((s) => `/en/${s}.html`),
  ];
}

/** يجمّع محتوى صفحة ماركة من الترجمات والإعدادات */
export const getBrandPage = cache(async (slug: string, locale: Locale) => {
  const config = MIGRATED_BRANDS[slug];
  if (!config) return null;

  const [t, service] = await Promise.all([
    getDictionary(locale),
    db.service.findUnique({
      where: { slug },
      include: { translations: { where: { locale } } },
    }),
  ]);

  if (!service || !service.isActive) return null;

  const p = config.prefix;
  const tr = service.translations[0];

  return {
    slug,
    name: tr?.name ?? slug,
    metaTitle: tr?.metaTitle,
    metaDescription: tr?.metaDescription,
    cssHref: `/css/${slug}.css`,

    hero: {
      tag: t(`${p}.hero.tag`),
      h1: t(`${p}.hero.h1`),
      sub: t(`${p}.hero.sub`),
      body: t(`${p}.hero.p`),
      badges: [t(`${p}.tb1`), t(`${p}.tb2`), t(`${p}.tb3`)].filter(Boolean),
      logo: config.logo,
      blendLogo: config.blendLogo ?? false,
      flag: config.flag,
      badge: t(`${p}.hero.badge`),
      bsub: t(`${p}.hero.bsub`),
    },

    about: {
      tag: t(`${p}.about.tag`),
      h2: t(`${p}.about.h2`),
      body: t(`${p}.about.p`),
      paragraphs: [t(`${p}.about.p2`), t(`${p}.about.p3`)].filter(Boolean),
      stats: [1, 2, 3].map((n) => ({
        num: t(`${p}.st${n}.num`),
        label: t(`${p}.st${n}.lbl`),
      })),
    },

    specs: {
      tag: t(`${p}.specs.tag`),
      h2: t(`${p}.specs.h2`),
      items: [1, 2, 3, 4, 5, 6].map((n) => ({
        value: t(`${p}.sp${n}.val`),
        label: t(`${p}.sp${n}.lbl`),
      })),
    },

    finish: config.finish
      ? {
          tag: t(`${p}.finish.tag`),
          h2: t(`${p}.finish.h2`),
          items: config.finish.map((f, i) => ({
            image: f.image,
            title: t(`${p}.f${i + 1}.h3`),
            body: t(`${p}.f${i + 1}.p`),
          })),
        }
      : null,

    gallery: {
      tag: t(`${p}.gal.tag`),
      h2: t(`${p}.gal.h2`),
      body: t(`${p}.gal.p`),
      images: config.gallery,
    },

    packages: {
      tag: t(`${p}.pkg.tag`),
      h2: t(`${p}.pkg.h2`),
      body: t(`${p}.pkg.p`),
      note: t(`${p}.pkg.note`),
      // كلايف تكتب الوحدة كاملة داخل المفتاح، والباقي يستعمل «د.ك» المشتركة
      unit: t(`${p}.pkg.unit`) || t('currency.kd'),
      style: config.packageStyle,
      // الشارة على الباقة الأولى — المفتاح اختلف بين الصفحات
      badge: t(`${p}.pkg1.badge`) || t(`${p}.pkg.badge`),
      cta: t(`${p}.pkg.wa`) || t(`${p}.btn.book`) || t('svc.btn.book'),
      items: [1, 2, 3].map((n, i) => ({
        tier: config.tiers[i] ?? '',
        name: t(`${p}.pkg${n}.name`),
        price: t(`${p}.pkg${n}.price`),
        features: config.packageFeatures[i].map((k) => t(`${p}.${k}`)).filter(Boolean),
      })),
    },

    faq: {
      tag: t(`${p}.faq.tag`),
      h2: t(`${p}.faq.h2`),
      items: [1, 2, 3, 4, 5, 6].map((n) => ({
        q: t(`${p}.faq.${n}.q`),
        a: t(`${p}.faq.${n}.a`),
      })),
    },

    cta: {
      h2: t(`${p}.cta.h2`),
      body: t(`${p}.cta.p`),
      book: t('svc.btn.book'),
    },
  };
});

/** صور معرض الأعمال المعروضة في الصفحة الرئيسية */
export const getFeaturedGallery = cache(async (locale: Locale) => {
  const items = await db.galleryItem.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { sortOrder: 'asc' },
    // شبكة المعرض في styles.css مصمّمة على خمس خانات (الأولى بارتفاع مضاعف) —
    // أي صورة سادسة تنزل في صف ناقص وتكسر التوازن
    take: GALLERY_SLOTS,
  });

  return items.map((g) => ({
    id: g.id,
    src: g.imageUrl,
    caption: (locale === 'en' ? g.captionEn || g.captionAr : g.captionAr) ?? '',
  }));
});

/** آراء العملاء — من الجدول إن وُجدت، وإلا من مفاتيح الترجمة المستوردة */
export const getTestimonials = cache(async (locale: Locale) => {
  const rows = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      body: decodeEntities(locale === 'en' ? r.bodyEn || r.bodyAr : r.bodyAr),
      author: r.author,
      carModel: r.carModel ?? '',
      avatar: r.avatar,
      rating: r.rating,
    }));
  }

  return null;
});
