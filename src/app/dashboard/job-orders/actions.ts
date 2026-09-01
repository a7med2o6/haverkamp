'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString, phoneSchema } from '@/lib/action-utils';
import { intakeLabel, serviceDef, warrantySubject } from '@/lib/intake';

function fils(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * يتحقّق أن السيارة تخصّ عميل الأمر.
 * السيارة تُختار من قائمة سيارات العميل في الواجهة، لكن الطلب يصل من
 * المتصفّح فيقبل أي معرّف — وسيارة عميل آخر في أمر شغل تفسد الكفالة
 * وسجلّ صيانة السيارتين معاً.
 */
async function assertVehicleBelongs(vehicleId: string, customerId: string) {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { customerId: true },
  });
  if (!vehicle || vehicle.customerId !== customerId) {
    throw new AppError('السيارة لا تخصّ عميل هذا الأمر');
  }
}

/** قراءة عداد صالحة أو null — نصّ فارغ ليس صفراً، و«abc» ليس رقماً */
function parseOdometer(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const km = Number(raw);
  if (!Number.isFinite(km) || km < 0) throw new AppError('قراءة العداد غير صالحة');
  return Math.round(km);
}

function parseWhen(raw: string | null | undefined, label: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new AppError(`${label} غير صالح`);
  return d;
}

/**
 * يتحقّق أن البند تابع فعلاً للأمر المذكور.
 * `jobOrderId` يصل من المتصفّح، فبدون هذا الفحص يمكن لطلب واحد أن يحذف
 * بند أمر لا يخصّه أو يعبث بقطعه.
 */
async function assertItemInJob(itemId: string, jobOrderId: string) {
  const item = await db.jobOrderItem.findUnique({
    where: { id: itemId },
    select: { jobOrderId: true },
  });
  if (!item) throw new AppError('البند غير موجود');
  if (item.jobOrderId !== jobOrderId) throw new AppError('البند لا يخصّ أمر الشغل هذا');
}

export const updateJobOrder = action({
  permission: 'workshop:write',
  schema: z.object({
    id: z.string(),
    vehicleId: optionalString,
    odometer: optionalString,
    promisedAt: optionalString,
    intakeNotes: optionalString,
    notes: optionalString,
  }),
  audit: { entity: 'JobOrder', action: 'UPDATE' },
  handler: async ({ id, vehicleId, odometer, promisedAt, intakeNotes, notes }) => {
    const job = await db.jobOrder.findUnique({ where: { id }, select: { customerId: true } });
    if (!job) throw new AppError('أمر الشغل غير موجود');

    if (vehicleId) await assertVehicleBelongs(vehicleId, job.customerId);

    await db.jobOrder.update({
      where: { id },
      data: {
        vehicleId: vehicleId || null,
        odometer: parseOdometer(odometer),
        promisedAt: parseWhen(promisedAt, 'موعد التسليم'),
        intakeNotes: intakeNotes ?? null,
        notes: notes ?? null,
      },
    });

    revalidatePath('/dashboard/job-orders');
    revalidatePath(`/dashboard/job-orders/${id}`);
    return { id, message: 'تم تحديث بيانات أمر الشغل' };
  },
});

export const setJobStatus = action({
  permission: 'workshop:write',
  schema: z.object({
    id: z.string(),
    status: z.enum([
      'RECEIVED',
      'IN_PROGRESS',
      'QUALITY_CHECK',
      'READY',
      'DELIVERED',
      'CANCELLED',
    ]),
  }),
  audit: { entity: 'JobOrder', action: 'STATUS' },
  handler: async ({ id, status }) => {
    const job = await db.jobOrder.findUnique({
      where: { id },
      select: { completedAt: true, deliveredAt: true },
    });
    if (!job) throw new AppError('أمر الشغل غير موجود');

    /*
      الطابع يُكتب عند بلوغ الحالة ويُمسح عند التراجع عنها.
      كان يُكتب بـundefined عند غير حالته، وهي في Prisma تعني «لا تغيّر»
      — فأمر عُلّم «مُسلَّم» بالخطأ ثم أُعيد إلى الورشة يحتفظ بتاريخ
      تسليمه إلى الأبد، فيكذب كل تقرير عن أوقات التسليم.
      وعند التقدّم من «جاهز» إلى «مُسلَّم» نُبقي الطابع الأول: لحظة
      الجاهزية لا تتغيّر لأن السيارة سُلّمت.
    */
    const done = status === 'READY' || status === 'DELIVERED';

    await db.jobOrder.update({
      where: { id },
      data: {
        status,
        completedAt: done ? (job.completedAt ?? new Date()) : null,
        deliveredAt:
          status === 'DELIVERED' ? (job.deliveredAt ?? new Date()) : null,
      },
    });

    revalidatePath('/dashboard/job-orders');
    revalidatePath(`/dashboard/job-orders/${id}`);
    return { id, message: 'تم تحديث حالة أمر الشغل' };
  },
});

export const deleteJobItem = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string(), jobOrderId: z.string() }),
  audit: { entity: 'JobOrderItem', action: 'DELETE' },
  handler: async ({ id, jobOrderId }) => {
    await assertItemInJob(id, jobOrderId);
    await db.jobOrderItem.delete({ where: { id } });
    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id, message: 'تم حذف البند' };
  },
});

/** ينشئ فاتورة من بنود أمر الشغل */
export const createInvoiceFromJob = action({
  permission: 'pos:write',
  schema: z.object({ jobOrderId: z.string() }),
  audit: { entity: 'Order', action: 'FROM_JOB' },
  handler: async ({ jobOrderId }, { userId }) => {
    const job = await db.jobOrder.findUnique({
      where: { id: jobOrderId },
      // محتويات الباقات بنود متابعة داخلية بصفر — الفاتورة تأخذ الآباء فقط
      include: { items: { where: { parentId: null } }, order: true },
    });

    if (!job) throw new AppError('أمر الشغل غير موجود');
    if (job.order) throw new AppError('توجد فاتورة مرتبطة بأمر الشغل بالفعل');
    if (job.items.length === 0) throw new AppError('لا يمكن إصدار فاتورة بدون بنود');

    const subtotal = fils(job.items.reduce((sum, i) => sum + Number(i.total), 0));

    const order = await db.order.create({
      data: {
        number: await nextNumber('invoice'),
        channel: 'INVOICE',
        status: 'DRAFT',
        customerId: job.customerId,
        jobOrderId: job.id,
        cashierId: userId,
        subtotal,
        total: subtotal,
        items: {
          create: job.items.map((i) => ({
            productId: i.productId,
            label: i.label,
            qty: i.qty,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidatePath('/dashboard/invoices');
    return { id: order.id, message: `تم إنشاء الفاتورة ${order.number}` };
  },
});

/** يصدر شهادة كفالة لأمر شغل */
export const issueWarranty = action({
  permission: 'crm:write',
  schema: z.object({
    jobOrderId: z.string(),
    /** موضوع الكفالة من قائمتها — أدقّ من الخدمة */
    subject: z.string().min(1, 'اختر موضوع الكفالة'),
    months: z.union([z.string(), z.number()]).transform(Number),
    terms: optionalString,
  }),
  audit: { entity: 'Warranty', action: 'ISSUE' },
  handler: async ({ jobOrderId, subject, months, terms }) => {
    if (!Number.isFinite(months) || months <= 0) throw new AppError('مدة الكفالة غير صالحة');

    const def = warrantySubject(subject);
    if (!def) throw new AppError('موضوع كفالة غير معروف');

    /*
      نستنبط الخدمة من سلَق الموضوع لا نأخذها من الطلب: «تبديل الجام»
      و«حماية الجام» موضوعان مختلفان تحت خدمة واحدة، فالموضوع هو ما يحفظ
      المعنى والخدمةُ رابطٌ للتقارير حيث يوجد لها مقابل.
    */
    const serviceId = def.slug
      ? ((await db.service.findUnique({ where: { slug: def.slug }, select: { id: true } }))?.id ??
        null)
      : null;

    const job = await db.jobOrder.findUnique({ where: { id: jobOrderId } });
    if (!job) throw new AppError('أمر الشغل غير موجود');
    if (!job.vehicleId) throw new AppError('لا يمكن إصدار كفالة بدون سيارة مرتبطة');

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const warranty = await db.warranty.create({
      data: {
        certificateNo: await nextNumber('warranty'),
        vehicleId: job.vehicleId,
        // الكفالة لمن دفعها لا للسيارة: بيعها لا ينقل الحقّ للمشتري
        customerId: job.customerId,
        serviceId,
        subject,
        // الشرط يُنسخ لحظة الإصدار: من كُفل بشرط يبقى شرطُه كما وُقّع
        // عليه وإن تغيّر الكتالوج بعده
        serviceEveryMonths: def.serviceEveryMonths ?? null,
        jobOrderId,
        startDate,
        endDate,
        terms,
      },
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidatePath('/dashboard/warranties');
    return { id: warranty.id, message: `تم إصدار الكفالة ${warranty.certificateNo}` };
  },
});

/**
 * يضبط فنيّي القطعة الواحدة.
 *
 * يستبدل القائمة كاملة بدل إضافة/حذف مفرد: الواجهة تعرض مربّعات اختيار
 * فتُرسل ما استقرّ عليه الموظف، ولا معنى لتتبّع الفروق بينهما.
 *
 * الغرض من هذا السجل المسؤولية لا التشغيل: حين تظهر مشكلة في باب بعينه
 * بعد أسابيع، يُعرف من ركّبه.
 */
export const setItemAssignees = action({
  permission: 'workshop:write',
  schema: z.object({
    itemId: z.string(),
    jobOrderId: z.string(),
    employeeIds: z.array(z.string()),
  }),
  audit: { entity: 'JobOrderItemAssignee', action: 'SET' },
  handler: async ({ itemId, jobOrderId, employeeIds }) => {
    await assertItemInJob(itemId, jobOrderId);

    // موظف واحد مرّتين في الطلب لا يعني صفّين
    const ids = [...new Set(employeeIds)];

    if (ids.length > 0) {
      const found = await db.employee.count({
        where: { id: { in: ids }, status: 'ACTIVE' },
      });
      if (found !== ids.length) throw new AppError('أحد الفنيين غير موجود أو غير نشط');
    }

    await db.$transaction([
      db.jobOrderItemAssignee.deleteMany({ where: { itemId } }),
      ...(ids.length > 0
        ? [
            db.jobOrderItemAssignee.createMany({
              data: ids.map((employeeId) => ({ itemId, employeeId })),
            }),
          ]
        : []),
    ]);

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id: itemId, message: 'تم حفظ الفنيين' };
  },
});

/**
 * «بيان تشغيل» — إنشاء أمر شغل من نموذج الاستلام كاملاً.
 *
 * يستبدل الدفتر الورقي: يسجّل الخدمات المطلوبة بخياراتها، ودرجة العزل
 * لكل قطعة زجاج، والقطع المشمولة بالحماية — كلها بنوداً قابلة للإسناد
 * والمتابعة بدل فقرة نصّ في «ملاحظات إضافية» لا يقرؤها شيء.
 *
 * القطع تُنشأ أبناءً للخدمة: الأب يحمل السعر والابن يحمل المواصفة ومن
 * اشتغل عليه — وهي البنية التي تفهمها الفاتورة أصلاً (تأخذ الآباء فقط).
 *
 * التوقيع يبقى على الورقة في الفترة الانتقالية، و`paperRef` هو ما يربط
 * السجل الرقمي بورقته عند النزاع.
 */
/** سطر خدمة واحد في بيان التشغيل — يُستعمل عند الاستلام وعند الإضافة لاحقاً */
const intakeLineSchema = z.object({
  /** مفتاح الخدمة في كتالوج بيان التشغيل */
  key: z.string().min(1),
  /** الخيارات الفرعية: «بدي كامل»، أو «داخلي» و«خارجي» معاً */
  options: z.array(z.string()).default([]),
  /** معرّف خدمة ماركة حماية البدي — لها باقات وأسعار */
  brand: optionalString,
  /** ماركة تُذكر بالاسم: فيلم العزل أو حماية الجام */
  brandName: optionalString,
  price: z.union([z.string(), z.number()]).transform(Number),
  /** القطع: اسمها ومواصفتها (درجة العازل) ومن يشتغل عليها */
  parts: z
    .array(
      z.object({
        label: z.string().min(1),
        spec: optionalString,
        employeeIds: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

type IntakeLine = z.infer<typeof intakeLineSchema>;

/**
 * ينشئ خدمةً وقطعها داخل أمر شغل.
 *
 * مشترك بين بيان التشغيل وإضافة بند لاحقاً: لولاه لتفرّع المنطقان فصار
 * البند المضاف من صفحة الأمر مختلف الشكل عن نظيره المُنشأ عند الاستلام
 * — نفس الخدمة باسمين وبنية.
 */
async function createJobLine(
  tx: Prisma.TransactionClient,
  jobOrderId: string,
  line: IntakeLine
) {
  const service = serviceDef(line.key);
  if (!service) throw new AppError('خدمة غير معروفة في بيان التشغيل');

  /*
    الماركة تصل معرّفاً لأن القائمة تعرض خدمات قاعدة البيانات.
    نخزّن اسمها في `spec` — المعرّف لا يُقرأ في جدول ولا في كفالة —
    ونربط البند بخدمتها في `serviceId` ليبقى الرابط قائماً للتقارير
    والكفالة.
  */
  let brandName: string | null = line.brandName ?? null;
  if (line.brand) {
    const brand = await tx.service.findUnique({
      where: { id: line.brand },
      include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
    });
    if (!brand) throw new AppError('الماركة غير موجودة');
    brandName = brand.translations[0]?.name ?? brand.slug;
  }

  const price = fils(line.price);
  const parent = await tx.jobOrderItem.create({
    data: {
      jobOrderId,
      label: intakeLabel(service, line.options),
      serviceId: line.brand || null,
      // الماركة مواصفة البند لا اسمه — فيبقى الاسم مطابقاً للورقة
      spec: brandName,
      qty: 1,
      unitPrice: price,
      total: price,
    },
  });

  // القطع تُنشأ واحدة واحدة لا دفعة: نحتاج معرّف كلٍّ منها لنسند فنييها
  for (const part of line.parts) {
    const child = await tx.jobOrderItem.create({
      data: {
        jobOrderId,
        parentId: parent.id,
        label: part.label,
        spec: part.spec,
        qty: 1,
        unitPrice: 0,
        total: 0,
      },
    });

    const ids = [...new Set(part.employeeIds)];
    if (ids.length > 0) {
      await tx.jobOrderItemAssignee.createMany({
        data: ids.map((employeeId) => ({ itemId: child.id, employeeId })),
      });
    }
  }

  return parent;
}

/** يضيف خدمةً بقطعها إلى أمر شغل قائم — بنفس بنية بيان التشغيل */
export const addJobLine = action({
  permission: 'workshop:write',
  schema: z.object({ jobOrderId: z.string(), line: intakeLineSchema }),
  audit: { entity: 'JobOrderItem', action: 'ADD_LINE' },
  handler: async ({ jobOrderId, line }) => {
    if (!Number.isFinite(line.price) || line.price < 0) {
      throw new AppError('سعر غير صالح — الصفر يعني «ضمن الباقة»');
    }
    const job = await db.jobOrder.findUnique({ where: { id: jobOrderId }, select: { id: true } });
    if (!job) throw new AppError('أمر الشغل غير موجود');

    await db.$transaction((tx) => createJobLine(tx, jobOrderId, line));

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id: jobOrderId, message: 'تمت إضافة البند' };
  },
});

export const createIntake = action({
  permission: 'workshop:write',
  schema: z.object({
    /** عميل مسجّل — أو `newCustomer` لعميل يُنشأ مع البيان */
    customerId: optionalString,
    newCustomer: z
      .object({
        name: z.string().trim().min(2, 'اسم العميل مطلوب'),
        phone: phoneSchema,
      })
      .nullish(),
    /** سيارة مسجّلة — قد تكون لمالك آخر فتُنقل ملكيتها */
    vehicleId: optionalString,
    newVehicle: z
      .object({
        make: z.string().trim().min(1, 'نوع السيارة مطلوب'),
        model: z.string().trim().min(1, 'موديل السيارة مطلوب'),
        year: z
          .union([z.string(), z.number()])
          .transform((v) => (v === '' || v === null ? null : Number(v)))
          .refine(
            (v) => v === null || (v >= 1950 && v <= new Date().getFullYear() + 2),
            'سنة الصنع غير صالحة'
          )
          .nullish(),
        color: optionalString,
        plateNo: optionalString,
      })
      .nullish(),
    odometer: optionalString,
    promisedAt: optionalString,
    paperRef: optionalString,
    intakeNotes: optionalString,
    /** الحجز الذي جاء منه البيان — يُربَط به ويُغلَق */
    bookingId: optionalString,
    lines: z.array(intakeLineSchema).min(1, 'اختر خدمة واحدة على الأقل'),
  }),
  audit: { entity: 'JobOrder', action: 'INTAKE' },
  handler: async (input) => {
    if (!input.customerId && !input.newCustomer) {
      throw new AppError('اختر عميلاً مسجّلاً أو أدخل بيانات عميل جديد');
    }

    for (const line of input.lines) {
      if (!Number.isFinite(line.price) || line.price < 0) {
        throw new AppError('سعر غير صالح — الصفر يعني «ضمن الباقة»');
      }
    }

    // كل الفنيين المذكورين في النموذج — نتحقّق منهم مرة قبل فتح المعاملة
    const techIds = [
      ...new Set(input.lines.flatMap((l) => l.parts.flatMap((p) => p.employeeIds))),
    ];
    if (techIds.length > 0) {
      const found = await db.employee.count({
        where: { id: { in: techIds }, status: 'ACTIVE' },
      });
      if (found !== techIds.length) throw new AppError('أحد الفنيين غير موجود أو غير نشط');
    }

    const job = await db.$transaction(async (tx) => {
      /*
        العميل والسيارة والأمر في حفظة واحدة.

        كان الاستقبال يفتح ثلاث شاشات ويحفظ ثلاث مرات والعميل واقف: ملف
        عميل، ثم سيارة في ملفه، ثم بيان تشغيل يبحث فيهما. والورقة تأخذ
        ذلك كلّه في مسح واحد، فكذلك تفعل الشاشة.
      */
      let customerId = input.customerId ?? null;
      if (!customerId && input.newCustomer) {
        // الرقم يمنع التكرار: من له ملف بهذا الرقم يُستعمل ملفه
        const existing = await tx.customer.findFirst({
          where: {
            OR: [
              { phone: input.newCustomer.phone },
              { pastPhones: { some: { phone: input.newCustomer.phone } } },
            ],
          },
          select: { id: true },
        });

        customerId =
          existing?.id ??
          (
            await tx.customer.create({
              data: {
                code: await nextNumber('customer'),
                name: input.newCustomer.name,
                phone: input.newCustomer.phone,
                source: 'WALK_IN',
              },
            })
          ).id;
      }
      if (!customerId) throw new AppError('تعذّر تحديد العميل');

      let vehicleId = input.vehicleId ?? null;

      if (vehicleId) {
        // سيارة مسجّلة لمالك آخر: يبيعها ويشتريها غيره، فتُنقل لا تُستنسخ
        const owned = await tx.vehicle.findUnique({
          where: { id: vehicleId },
          select: { customerId: true },
        });
        if (!owned) throw new AppError('السيارة غير موجودة');

        if (owned.customerId !== customerId) {
          const now = new Date();
          await tx.vehicleOwnership.updateMany({
            where: { vehicleId, to: null },
            data: { to: now },
          });
          await tx.vehicleOwnership.create({
            data: { vehicleId, customerId, from: now },
          });
          await tx.vehicle.update({ where: { id: vehicleId }, data: { customerId } });
        }
      } else if (input.newVehicle) {
        const v = await tx.vehicle.create({
          data: {
            customerId,
            make: input.newVehicle.make,
            model: input.newVehicle.model,
            year: input.newVehicle.year,
            color: input.newVehicle.color,
            plateNo: input.newVehicle.plateNo,
          },
        });
        await tx.vehicleOwnership.create({ data: { vehicleId: v.id, customerId } });
        vehicleId = v.id;
      }

      const created = await tx.jobOrder.create({
        data: {
          number: await nextNumber('job'),
          customerId,
          vehicleId,
          odometer: parseOdometer(input.odometer),
          promisedAt: parseWhen(input.promisedAt, 'موعد التسليم'),
          paperRef: input.paperRef,
          intakeNotes: input.intakeNotes,
          bookingId: input.bookingId,
        },
      });

      for (const line of input.lines) {
        await createJobLine(tx, created.id, line);
      }

      // الحجز صار شغلاً — يخرج من قوائم الانتظار والتذكير
      if (input.bookingId) {
        await tx.booking.update({
          where: { id: input.bookingId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return created;
    });

    revalidatePath('/dashboard/job-orders');
    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/customers');
    return { id: job.id, message: `تم إنشاء بيان التشغيل ${job.number}` };
  },
});

/**
 * يبحث عن سيارة برقم لوحتها.
 *
 * اللوحة هوية السيارة، فالبحث بها يكشف حالتين: سيارة العميل نفسه فتُختار،
 * وسيارة عميل آخر فيُنبَّه الموظف إلى أن حفظ البيان ينقل ملكيتها — وهو
 * ما يقع فعلاً حين تُباع السيارة وتعود بمالك جديد.
 */
export const lookupPlate = action({
  permission: 'workshop:read',
  schema: z.object({ plateNo: z.string().trim().min(1) }),
  handler: async ({ plateNo }) => {
    const vehicle = await db.vehicle.findUnique({
      where: { plateNo },
      select: {
        id: true,
        make: true,
        model: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });

    if (!vehicle) return { data: { found: false } };

    return {
      data: {
        found: true,
        id: vehicle.id,
        label: `${vehicle.make} ${vehicle.model}`,
        ownerId: vehicle.customerId,
        ownerName: vehicle.customer.name,
      },
    };
  },
});

/**
 * سيارات عميل مسجّل.
 *
 * العميل الواحد يملك أكثر من سيارة — والموظف لا يحفظ لوحاتها. تُقرأ عند
 * اختياره لا مع الصفحة، فقائمة سيارات كل العملاء حِملٌ يُنقل بلا داعٍ.
 */
export const customerVehicles = action({
  permission: 'workshop:read',
  schema: z.object({ customerId: z.string().min(1) }),
  handler: async ({ customerId }) => {
    const vehicles = await db.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, make: true, model: true, year: true, plateNo: true },
    });

    return {
      data: {
        vehicles: vehicles.map((v) => ({
          id: v.id,
          label: `${v.make} ${v.model}${v.year ? ` — ${v.year}` : ''}`,
          plateNo: v.plateNo,
        })),
      },
    };
  },
});
