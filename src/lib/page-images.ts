import { db } from '@/lib/db';

/**
 * صور الصفحات.
 *
 * كانت مساراتها مكتوبة في الكود، فتغيير صورة يحتاج مبرمجاً. صارت خانات
 * مسمّاة يُخزَّن بديلها في الإعدادات بمفتاح `img.<الصفحة>.<الخانة>`، ويبقى
 * المسار الأصلي قيمةً افتراضية إن لم يُرفع بديل — فلا تنكسر صفحة لم
 * تُحرَّر صورها.
 */

export interface ImageSlot {
  /** مفتاح الإعداد الكامل */
  key: string;
  label: string;
  hint?: string;
  /** المسار المستعمل فعلاً: البديل إن وُجد وإلا الأصلي */
  url: string;
  /** المسار المكتوب في الكود — يُعرض كمرجع عند الاستعادة */
  fallback: string;
}

interface SlotSpec {
  slot: string;
  label: string;
  hint?: string;
  fallback: string;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** خانات صور كل صفحة */
function slotSpecs(page: string): SlotSpec[] {
  // صفحات الخدمة الثلاث: صورة رأس ومعرض من ست صور
  const service = (slug: string, ext: string): SlotSpec[] => [
    {
      slot: 'hero',
      label: 'صورة رأس الصفحة',
      hint: 'الصورة الكبيرة بجانب العنوان',
      fallback: `/assets/services/${slug}/${slug}-hero.${ext}`,
    },
    ...range(6).map((n) => ({
      slot: `gal${n}`,
      label: `صورة المعرض ${n}`,
      fallback: `/assets/services/${slug}/${slug}-gal-${n}.${ext}`,
    })),
  ];

  const brandGallery = (n: number) => `/assets/services/main/pro-${n}.webp`;

  const finish = (): SlotSpec[] => [
    {
      slot: 'finish1',
      label: 'أنواع الحماية — شفاف',
      fallback: '/assets/services/body-protection/lam3a-1.jpg',
    },
    {
      slot: 'finish2',
      label: 'أنواع الحماية — مطفي',
      fallback: '/assets/services/body-protection/mate.png',
    },
    {
      slot: 'finish3',
      label: 'أنواع الحماية — تغيير لون',
      fallback: '/assets/services/body-protection/color.jpg',
    },
  ];

  switch (page) {
    case 'glass':
      return service('glass', 'jpg');
    case 'polish':
      return service('polish', 'png');
    case 'paint':
      return service('paint', 'png');

    case 'haverkamp':
      return [
        {
          slot: 'logo',
          label: 'شعار الماركة',
          hint: 'يظهر في لوحة رأس الصفحة',
          fallback: '/assets/services/haverkamp/haverkamp.png',
        },
        ...range(6).map((n) => ({
          slot: `gal${n}`,
          label: `صورة المعرض ${n}`,
          fallback: `/assets/services/haverkamp/gallery/g${n}.webp`,
        })),
      ];

    case 'clif':
      return [
        {
          slot: 'logo',
          label: 'شعار الماركة',
          fallback: '/assets/services/clif/clif-logo.jpg',
        },
        ...finish(),
        ...range(6).map((n) => ({
          slot: `gal${n}`,
          label: `صورة المعرض ${n}`,
          fallback: brandGallery(n),
        })),
      ];

    case 'iron':
      return [
        { slot: 'logo', label: 'شعار الماركة', fallback: '/assets/services/iron/iron.png' },
        ...finish(),
        ...range(6).map((n) => ({
          slot: `gal${n}`,
          label: `صورة المعرض ${n}`,
          fallback: brandGallery(n),
        })),
      ];

    case 'tint':
      return [
        {
          slot: 'hero',
          label: 'صورة رأس الصفحة',
          fallback: '/assets/services/tint/tint-hero.webp',
        },
        {
          slot: 'before',
          label: 'مقارنة — قبل',
          hint: 'الصورة اليسرى في شريحة السحب',
          fallback: '/assets/services/tint/tint-before.jpg',
        },
        {
          slot: 'after',
          label: 'مقارنة — بعد',
          fallback: '/assets/services/tint/tint-after.jpg',
        },
        {
          slot: 'brand1',
          label: 'شعار العلامة 1',
          fallback: '/assets/services/tint/brand-haverkamp.png',
        },
        {
          slot: 'brand2',
          label: 'شعار العلامة 2',
          fallback: '/assets/services/tint/brand-suntek.jpg',
        },
        {
          slot: 'brand3',
          label: 'شعار العلامة 3',
          fallback: '/assets/services/tint/brand-aswf.jpeg',
        },
        {
          slot: 'brand4',
          label: 'شعار العلامة 4',
          fallback: '/assets/services/tint/brand-royal-shield.png',
        },
        ...range(6).map((n) => ({
          slot: `gal${n}`,
          label: `صورة المعرض ${n}`,
          fallback: `/assets/services/tint/tint-gal-${n}.jpg`,
        })),
      ];

    case 'protication':
      return [
        {
          slot: 'hero',
          label: 'صورة رأس الصفحة',
          fallback: '/assets/services/body-protection/protication.webp',
        },
        {
          slot: 'before',
          label: 'مقارنة — قبل',
          fallback: '/assets/services/body-protection/ppf-before.webp',
        },
        {
          slot: 'after',
          label: 'مقارنة — بعد',
          fallback: '/assets/services/body-protection/after.webp',
        },
        ...finish(),
        {
          slot: 'studio',
          label: 'صورة استوديو الألوان',
          fallback: '/assets/color-change.webp',
        },
        {
          slot: 'brand1',
          label: 'شعار هافركامب',
          fallback: '/assets/services/body-protection/haverkamp.png',
        },
        {
          slot: 'brand2',
          label: 'شعار كلايف',
          fallback: '/assets/services/body-protection/clif-logo.jpg',
        },
        {
          slot: 'brand3',
          label: 'شعار أيرون',
          fallback: '/assets/services/body-protection/iron.png',
        },
      ];

    case 'wash':
      return [
        {
          slot: 'hero',
          label: 'صورة رأس الصفحة',
          fallback: '/assets/services/wash/wash-hero.png',
        },
        ...range(6).map((n) => ({
          slot: `gal${n}`,
          label: `صورة المعرض ${n}`,
          fallback: `/assets/services/wash/wash-gal-${n}.png`,
        })),
      ];

    case 'home':
      return [
        {
          slot: 'logo',
          label: 'شعار هافركامب في رأس الصفحة',
          fallback: '/assets/haverkamp.png',
        },
        {
          slot: 'car',
          label: 'صورة السيارة الكبيرة',
          hint: 'الصورة الرئيسية أسفل العنوان',
          fallback: '/assets/main.webp',
        },
      ];

    default:
      return [];
  }
}

/** المفاتيح التي يملكها كل صفحة — لرفض ما عداها عند الحفظ */
export function pageImageKeys(page: string): string[] {
  return slotSpecs(page).map((s) => `img.${page}.${s.slot}`);
}

/** يقرأ خانات صور صفحة مع بدائلها المحفوظة */
export async function getPageImages(page: string): Promise<ImageSlot[]> {
  const specs = slotSpecs(page);
  if (specs.length === 0) return [];

  const rows = await db.siteSetting.findMany({
    where: { key: { in: specs.map((s) => `img.${page}.${s.slot}`) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return specs.map((s) => {
    const key = `img.${page}.${s.slot}`;
    const saved = byKey.get(key);
    const url = typeof saved === 'string' && saved.trim() ? saved : s.fallback;
    return { key, label: s.label, hint: s.hint, url, fallback: s.fallback };
  });
}

/**
 * مُحلّل الصور للاستعمال أثناء تصيير الصفحات العامة.
 * يُبنى مرة لكل صفحة ثم يُستدعى لكل خانة.
 */
export async function imageResolver(page: string) {
  const slots = await getPageImages(page);
  const bySlot = new Map(slots.map((s) => [s.key.split('.').pop()!, s.url]));

  return function img(slot: string, fallback: string): string {
    return bySlot.get(slot) ?? fallback;
  };
}
