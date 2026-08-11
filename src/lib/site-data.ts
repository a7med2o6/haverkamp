import { cache } from 'react';
import { db } from '@/lib/db';

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
