'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';
import { MIGRATED_SERVICES } from '@/lib/site-data';

/** يُحدِّث الموقع العام بعد أي تعديل محتوى */
function revalidateSite(slug?: string) {
  revalidatePath('/');
  revalidatePath('/en');
  if (slug && MIGRATED_SERVICES[slug]) revalidatePath(`/${slug}.html`);
}

// ═══════════════════════════════════════════════════════════
//  الخدمات
// ═══════════════════════════════════════════════════════════

const serviceSchema = z.object({
  id: z.string(),
  cardImage: optionalString,
  heroImage: optionalString,
  sortOrder: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  isActive: z.boolean(),
  showInNav: z.boolean(),
  ar: z.object({
    name: z.string().trim().min(2, 'اسم الخدمة بالعربية مطلوب'),
    tagline: optionalString,
    shortDesc: optionalString,
    metaTitle: optionalString,
    metaDescription: optionalString,
  }),
  en: z.object({
    name: optionalString,
    tagline: optionalString,
    shortDesc: optionalString,
    metaTitle: optionalString,
    metaDescription: optionalString,
  }),
});

export const saveService = action({
  permission: 'cms:write',
  schema: serviceSchema,
  audit: { entity: 'Service', action: 'SAVE' },
  handler: async ({ id, ar, en, ...rest }) => {
    const service = await db.service.findUnique({ where: { id }, select: { slug: true } });
    if (!service) throw new AppError('الخدمة غير موجودة');

    await db.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: rest });

      await tx.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: id, locale: 'ar' } },
        update: ar,
        create: { serviceId: id, locale: 'ar', ...ar },
      });

      // الإنجليزية اختيارية — لا ننشئ سجلاً فارغاً بلا اسم
      if (en.name) {
        await tx.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: id, locale: 'en' } },
          update: { ...en, name: en.name },
          create: { serviceId: id, locale: 'en', ...en, name: en.name },
        });
      }
    });

    revalidatePath('/dashboard/cms/services');
    revalidateSite(service.slug);
    return { id, message: `تم تحديث ${ar.name}` };
  },
});

export const toggleServiceActive = action({
  permission: 'cms:write',
  schema: z.object({ id: z.string(), isActive: z.boolean() }),
  audit: { entity: 'Service', action: 'TOGGLE' },
  handler: async ({ id, isActive }) => {
    const service = await db.service.update({
      where: { id },
      data: { isActive },
      select: { slug: true },
    });

    revalidatePath('/dashboard/cms/services');
    revalidateSite(service.slug);
    return { id, message: isActive ? 'تم إظهار الخدمة' : 'تم إخفاء الخدمة من الموقع' };
  },
});

// ═══════════════════════════════════════════════════════════
//  الترجمات
// ═══════════════════════════════════════════════════════════

export const saveTranslation = action({
  permission: 'cms:write',
  schema: z.object({
    key: z.string().trim().min(1),
    ar: z.string().max(2000),
    en: z.string().max(2000).optional(),
  }),
  audit: { entity: 'Translation', action: 'SAVE' },
  handler: async ({ key, ar, en }) => {
    const existing = await db.translation.findUnique({ where: { key } });
    if (!existing) throw new AppError('المفتاح غير موجود');

    if (!ar.trim()) throw new AppError('النص العربي لا يمكن أن يكون فارغاً');

    await db.translation.update({
      where: { key },
      data: { ar, en: en?.trim() ? en : null },
    });

    revalidatePath('/dashboard/cms/translations');
    // النص قد يظهر في أي صفحة — نُبطل الرئيسية وصفحات الخدمات المنقولة
    revalidateSite();
    for (const slug of Object.keys(MIGRATED_SERVICES)) revalidatePath(`/${slug}.html`);

    return { id: key, message: 'تم حفظ النص' };
  },
});

// ═══════════════════════════════════════════════════════════
//  إعدادات الموقع
// ═══════════════════════════════════════════════════════════

export const saveSetting = action({
  permission: 'cms:write',
  schema: z.object({
    key: z.string().trim().min(1),
    value: z.string().max(500),
  }),
  audit: { entity: 'SiteSetting', action: 'SAVE' },
  handler: async ({ key, value }) => {
    const existing = await db.siteSetting.findUnique({ where: { key } });
    if (!existing) throw new AppError('الإعداد غير موجود');

    // نحافظ على نوع القيمة الأصلي — الأرقام تبقى أرقاماً في JSON
    const parsed: unknown =
      typeof existing.value === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))
        ? Number(value)
        : value;

    await db.siteSetting.update({ where: { key }, data: { value: parsed as never } });

    revalidatePath('/dashboard/cms/settings');
    revalidateSite();
    return { id: key, message: 'تم حفظ الإعداد' };
  },
});

// ═══════════════════════════════════════════════════════════
//  معرض الصور
// ═══════════════════════════════════════════════════════════

const gallerySchema = z.object({
  id: z.string().optional(),
  imageUrl: z.string().trim().min(1, 'الصورة مطلوبة'),
  captionAr: optionalString,
  captionEn: optionalString,
  serviceId: optionalString,
  sortOrder: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});

export const saveGalleryItem = action({
  permission: 'cms:write',
  schema: gallerySchema,
  audit: { entity: 'GalleryItem', action: 'SAVE' },
  handler: async ({ id, ...data }) => {
    if (id) {
      await db.galleryItem.update({ where: { id }, data });
      revalidatePath('/dashboard/cms/gallery');
      revalidateSite();
      return { id, message: 'تم تحديث الصورة' };
    }

    const created = await db.galleryItem.create({ data });
    revalidatePath('/dashboard/cms/gallery');
    revalidateSite();
    return { id: created.id, message: 'تمت إضافة الصورة' };
  },
});

export const deleteGalleryItem = action({
  permission: 'cms:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'GalleryItem', action: 'DELETE' },
  handler: async ({ id }) => {
    await db.galleryItem.delete({ where: { id } });
    revalidatePath('/dashboard/cms/gallery');
    revalidateSite();
    return { id, message: 'تم حذف الصورة' };
  },
});

// ═══════════════════════════════════════════════════════════
//  آراء العملاء
// ═══════════════════════════════════════════════════════════

const testimonialSchema = z.object({
  id: z.string().optional(),
  author: z.string().trim().min(2, 'اسم العميل مطلوب'),
  bodyAr: z.string().trim().min(5, 'نص الرأي مطلوب'),
  bodyEn: optionalString,
  carModel: optionalString,
  avatar: optionalString,
  rating: z
    .union([z.string(), z.number()])
    .transform(Number)
    .refine((n) => n >= 1 && n <= 5, 'التقييم من 1 إلى 5'),
  sortOrder: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  isActive: z.boolean(),
});

export const saveTestimonial = action({
  permission: 'cms:write',
  schema: testimonialSchema,
  audit: { entity: 'Testimonial', action: 'SAVE' },
  handler: async ({ id, ...data }) => {
    if (id) {
      await db.testimonial.update({ where: { id }, data });
      revalidatePath('/dashboard/cms/testimonials');
      revalidateSite();
      return { id, message: 'تم تحديث الرأي' };
    }

    const created = await db.testimonial.create({ data });
    revalidatePath('/dashboard/cms/testimonials');
    revalidateSite();
    return { id: created.id, message: `تمت إضافة رأي ${data.author}` };
  },
});

export const deleteTestimonial = action({
  permission: 'cms:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Testimonial', action: 'DELETE' },
  handler: async ({ id }) => {
    const remaining = await db.testimonial.count({ where: { isActive: true, NOT: { id } } });
    if (remaining === 0) {
      throw new AppError(
        'هذا آخر رأي منشور — حذفه يُرجع الموقع إلى الآراء الافتراضية. أوقفه بدل حذفه إن أردت إخفاءه'
      );
    }

    await db.testimonial.delete({ where: { id } });
    revalidatePath('/dashboard/cms/testimonials');
    revalidateSite();
    return { id, message: 'تم حذف الرأي' };
  },
});
