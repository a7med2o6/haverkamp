import { cache } from 'react';
import { db } from '@/lib/db';

export type Locale = 'ar' | 'en';

export const LOCALES: Locale[] = ['ar', 'en'];

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
    dict.set(row.key, (locale === 'en' ? row.en || row.ar : row.ar) ?? '');
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

/** آراء العملاء — من الجدول إن وُجدت، وإلا من مفاتيح الترجمة المستوردة */
export const getTestimonials = cache(async (locale: Locale) => {
  const rows = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      body: locale === 'en' ? r.bodyEn || r.bodyAr : r.bodyAr,
      author: r.author,
      carModel: r.carModel ?? '',
      avatar: r.avatar,
      rating: r.rating,
    }));
  }

  return null;
});
