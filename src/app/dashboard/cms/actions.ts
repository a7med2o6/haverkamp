'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, action, optionalString } from '@/lib/action-utils';
import { migratedPaths } from '@/lib/site-data';
import { homeContentKeys, serviceContentKeys } from '@/lib/service-content';
import { pageImageKeys } from '@/lib/page-images';

/**
 * يُحدِّث الموقع العام بعد أي تعديل محتوى.
 * نُبطل كل الصفحات المنقولة لا صفحة الخدمة وحدها — النصوص المشتركة
 * (القائمة، التذييل، بيانات التواصل) تظهر في كل صفحة.
 */
function revalidateSite() {
  for (const path of migratedPaths()) revalidatePath(path);
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
    revalidateSite();
    return { id, message: `تم تحديث ${ar.name}` };
  },
});

export const toggleServiceActive = action({
  permission: 'cms:write',
  schema: z.object({ id: z.string(), isActive: z.boolean() }),
  audit: { entity: 'Service', action: 'TOGGLE' },
  handler: async ({ id, isActive }) => {
    await db.service.update({ where: { id }, data: { isActive } });

    revalidatePath('/dashboard/cms/services');
    revalidateSite();
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
    // النص قد يظهر في أي صفحة — نُبطل الرئيسية والصفحات المنقولة كلها
    revalidateSite();

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

// ═══════════════════════════════════════════════════════════
//  محتوى صفحة الخدمة
// ═══════════════════════════════════════════════════════════

/**
 * يحفظ محتوى صفحة خدمة كاملة دفعة واحدة.
 * التحرير يجري على مستوى الصفحة لا المفتاح، فالحفظ معاملة واحدة: إمّا
 * تُحفظ الصفحة كلها أو لا شيء — فلا تبقى نصفها القديم ونصفها الجديد.
 */
export const saveServiceContent = action({
  permission: 'cms:write',
  schema: z.object({
    slug: z.string().trim().min(1),
    /** بيانات سجل الخدمة — تُحفظ مع النصوص في معاملة واحدة */
    service: z
      .object({
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
      })
      .optional(),
    fields: z
      .array(
        z.object({
          key: z.string().trim().min(1),
          ar: z.string().max(2000),
          en: z.string().max(2000),
        })
      )
      .default([]),
    /** بدائل صور الصفحة — مفتاح الإعداد إلى المسار */
    images: z.record(z.string(), z.string().max(500)).optional(),
  }),
  audit: { entity: 'Service', action: 'SAVE_CONTENT' },
  handler: async ({ slug, service, fields, images }) => {
    const imageEntries = Object.entries(images ?? {});
    if (!service && fields.length === 0 && imageEntries.length === 0) {
      throw new AppError('لا يوجد ما يُحفظ');
    }

    if (imageEntries.length) {
      const allowedImages = new Set(pageImageKeys(slug));
      const strayImage = imageEntries.find(([k]) => !allowedImages.has(k));
      if (strayImage) throw new AppError('صورة غير معروفة في هذه الصفحة');
    }

    // لا نقبل إلا مفاتيح هذه الصفحة — الطلب يأتي من المتصفح
    const allowed = new Set(serviceContentKeys(slug));
    if (allowed.size === 0) throw new AppError('هذه الخدمة لا تُحرَّر من هنا بعد');

    const stray = fields.find((f) => !allowed.has(f.key));
    if (stray) throw new AppError('حقل غير معروف في هذه الصفحة');

    const empty = fields.find((f) => !f.ar.trim());
    if (empty) throw new AppError('النص العربي مطلوب في كل الحقول');

    await db.$transaction(async (tx) => {
      for (const f of fields) {
        await tx.translation.upsert({
          where: { key: f.key },
          update: { ar: f.ar, en: f.en.trim() ? f.en : null },
          create: { key: f.key, ar: f.ar, en: f.en.trim() ? f.en : null, group: slug },
        });
      }

      for (const [key, url] of imageEntries) {
        await tx.siteSetting.upsert({
          where: { key },
          update: { value: url },
          create: { key, value: url, group: 'images' },
        });
      }

      if (!service) return;

      const { ar, en, ...rest } = service;
      const row = await tx.service.findUnique({ where: { slug }, select: { id: true } });
      if (!row) throw new AppError('الخدمة غير موجودة');

      await tx.service.update({ where: { id: row.id }, data: rest });

      await tx.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: row.id, locale: 'ar' } },
        update: ar,
        create: { serviceId: row.id, locale: 'ar', ...ar },
      });

      // الإنجليزية اختيارية — لا ننشئ سجلاً فارغاً بلا اسم
      if (en.name) {
        await tx.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: row.id, locale: 'en' } },
          update: { ...en, name: en.name },
          create: { serviceId: row.id, locale: 'en', ...en, name: en.name },
        });
      }
    });

    revalidatePath('/dashboard/cms/services');
    revalidatePath(`/dashboard/cms/services/${slug}`);
    revalidateSite();

    const parts = [
      service ? 'بيانات الخدمة' : null,
      fields.length ? `${fields.length} نصاً` : null,
      imageEntries.length ? `${imageEntries.length} صورة` : null,
    ].filter(Boolean);

    return { id: slug, message: `تم الحفظ — ${parts.join(' و')}` };
  },
});

// ═══════════════════════════════════════════════════════════
//  محتوى الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════

/** أرقام شريط الإحصائيات — قيم عددية في الإعدادات لا نصوص ترجمة */
const HOME_STAT_KEYS = ['stats.years', 'stats.clients', 'stats.cars'] as const;

export const saveHomeContent = action({
  permission: 'cms:write',
  schema: z.object({
    fields: z
      .array(
        z.object({
          key: z.string().trim().min(1),
          ar: z.string().max(2000),
          en: z.string().max(2000),
        })
      )
      .default([]),
    /** أرقام شريط الإحصائيات */
    stats: z.record(z.string(), z.number().int().nonnegative()).optional(),
    /** بدائل صور الصفحة — مفتاح الإعداد إلى المسار */
    images: z.record(z.string(), z.string().max(500)).optional(),
  }),
  audit: { entity: 'Translation', action: 'SAVE_HOME' },
  handler: async ({ fields, stats, images }) => {
    const statEntries = Object.entries(stats ?? {});
    const imageEntries = Object.entries(images ?? {});
    if (fields.length === 0 && statEntries.length === 0 && imageEntries.length === 0) {
      throw new AppError('لا يوجد ما يُحفظ');
    }

    if (imageEntries.length) {
      const allowedImages = new Set(pageImageKeys('home'));
      const strayImage = imageEntries.find(([k]) => !allowedImages.has(k));
      if (strayImage) throw new AppError('صورة غير معروفة في الصفحة الرئيسية');
    }

    const allowed = new Set(homeContentKeys());
    const stray = fields.find((f) => !allowed.has(f.key));
    if (stray) throw new AppError('حقل غير معروف في الصفحة الرئيسية');

    const strayStat = statEntries.find(([k]) => !HOME_STAT_KEYS.includes(k as never));
    if (strayStat) throw new AppError('رقم غير معروف في شريط الإحصائيات');

    const empty = fields.find((f) => !f.ar.trim());
    if (empty) throw new AppError('النص العربي مطلوب في كل الحقول');

    await db.$transaction(async (tx) => {
      for (const f of fields) {
        await tx.translation.upsert({
          where: { key: f.key },
          update: { ar: f.ar, en: f.en.trim() ? f.en : null },
          create: { key: f.key, ar: f.ar, en: f.en.trim() ? f.en : null, group: 'home' },
        });
      }

      for (const [key, value] of statEntries) {
        await tx.siteSetting.update({ where: { key }, data: { value } });
      }

      for (const [key, url] of imageEntries) {
        await tx.siteSetting.upsert({
          where: { key },
          update: { value: url },
          create: { key, value: url, group: 'images' },
        });
      }
    });

    revalidatePath('/dashboard/cms/home');
    revalidateSite();

    const parts = [
      fields.length ? `${fields.length} نصاً` : null,
      statEntries.length ? 'أرقام الإحصائيات' : null,
      imageEntries.length ? `${imageEntries.length} صورة` : null,
    ].filter(Boolean);

    return { id: 'home', message: `تم الحفظ — ${parts.join(' و')}` };
  },
});
