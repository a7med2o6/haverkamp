'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { AppError, action, optionalString, phoneSchema } from '@/lib/action-utils';
import { normalizePlate } from '@/lib/search';
import { vehicleIdsByPlate } from '@/lib/search-db';
import {
  PAINT_PARTS,
  RIMS_PART_KEY,
  intakeLabel,
  paintLabel,
  paintPartLabel,
  paintSpec,
  serviceDef,
  warrantyHasParts,
  warrantyPartValid,
  warrantySubject,
  type IntakeService,
} from '@/lib/intake';

const PAINT_PART_KEYS = new Set<string>(PAINT_PARTS.map((part) => part.key));

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

/**
 * بنود الأمر لا تُمسّ بعد التسليم: خرجت السيارة بما عليها، وصار ما في
 * الأمر وفاتورته سجلاً لما جرى لا مسودةً لما سيجري.
 */
async function assertJobOpen(jobOrderId: string) {
  const job = await db.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { status: true },
  });
  if (!job) throw new AppError('أمر الشغل غير موجود');
  if (job.status === 'DELIVERED') {
    throw new AppError('سُلّمت السيارة — بنود أمرها وفاتورتها صارت سجلاً لا يُعدَّل');
  }
}

/** نصّ بند الفاتورة: الصبغ يحمل تشطيبه وكوده — «صبغ دائم — قطع بدي · مطفي · كود LY9T» */
function invoiceLineLabel(item: { label: string; spec: string | null; paint: unknown }) {
  return item.paint && item.spec ? `${item.label} · ${item.spec}` : item.label;
}

/** بنود الفاتورة من بنود الأمر: الآباء المسعَّرة وحدها، بترتيب الأمر */
function invoiceLinesOf(jobOrderId: string, tx: Prisma.TransactionClient) {
  return tx.jobOrderItem.findMany({
    // محتويات الباقات بنود متابعة داخلية بصفر — الفاتورة تأخذ الآباء فقط
    where: { jobOrderId, parentId: null, isPriced: true },
    orderBy: { id: 'asc' },
    select: {
      productId: true,
      label: true,
      spec: true,
      qty: true,
      unitPrice: true,
      total: true,
      paint: { select: { id: true } },
    },
  });
}

/**
 * فاتورة الأمر تتبعه حتى التسليم.
 *
 * كانت الفاتورة تنسخ البنود ساعة صدورها ثم تنفصل عنها: بندٌ أُضيف بعدها
 * لا يصل إليها، والتسليم لا يسأل إلا «هل سُدِّدت الفاتورة؟» — فتخرج
 * السيارة مسدَّدةً وشغلٌ عليها لم يُطالَب به أحد. وسعرٌ صُحِّح بعدها لا
 * مكان لتصحيحه، فالفاتورة لا تعرف إلا الخصم.
 *
 * فصار كل تغيير على بنود الأمر يُعيد بناء بنود فاتورته في المعاملة نفسها:
 * لا لحظةَ يقول فيها الأمر رقماً والفاتورة رقماً آخر. والخصم يبقى كما
 * سُجِّل، والإجمالي لا ينزل تحت ما حُصِّل — كقاعدة الخصم نفسها.
 *
 * البند غير المسعَّر لا يدخل الفاتورة حتى يُسعَّر، والتسليم يمنعه: صفرُه
 * ليس مجاناً.
 */
async function syncJobInvoice(tx: Prisma.TransactionClient, jobOrderId: string) {
  const order = await tx.order.findUnique({
    where: { jobOrderId },
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      discountAmount: true,
      taxAmount: true,
      paidAmount: true,
    },
  });
  // الملغاة والمرتجعة انتهى أمرها — لا تُبعث من جديد بتعديل بند
  if (!order || order.status === 'CANCELLED' || order.status === 'REFUNDED') return null;

  const lines = await invoiceLinesOf(jobOrderId, tx);
  const subtotal = fils(lines.reduce((sum, i) => sum + Number(i.total), 0));
  const discount = Number(order.discountAmount);
  const paid = Number(order.paidAmount);

  if (discount > subtotal) {
    throw new AppError(
      `خصم الفاتورة ${order.number} (${discount.toFixed(3)} د.ك) يصير أكبر من قيمتها — عدّل الخصم أولاً`
    );
  }
  const total = fils(subtotal - discount + Number(order.taxAmount));
  if (total < paid) {
    throw new AppError(
      `حُصِّل من الفاتورة ${order.number} ${paid.toFixed(3)} د.ك — لا ينزل إجماليها تحت المحصَّل`
    );
  }

  await tx.orderItem.deleteMany({ where: { orderId: order.id } });
  await tx.orderItem.createMany({
    data: lines.map((i) => ({
      orderId: order.id,
      productId: i.productId,
      label: invoiceLineLabel(i),
      qty: i.qty,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
  });

  // الصفرُ سداد، كما في التسليم: فاتورة كفالةٍ أو مجاملةٍ بصفر مسدَّدة
  const status = paid >= total ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'DRAFT';
  await tx.order.update({ where: { id: order.id }, data: { subtotal, total, status } });

  return { id: order.id, customerId: order.customerId };
}

/** ما يعرض الفاتورة أو مستحقّها — يُبطَل مع كل مزامنة */
function revalidateInvoice(invoice: { id: string; customerId: string | null } | null) {
  if (!invoice) return;
  // قائمة الأوامر تعرض إجمالي الفاتورة لكل أمر — فتتبعها
  revalidatePath('/dashboard/job-orders');
  revalidatePath('/dashboard/invoices');
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  if (invoice.customerId) revalidatePath(`/dashboard/customers/${invoice.customerId}`);
  revalidatePath('/dashboard');
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
      select: {
        completedAt: true,
        deliveredAt: true,
        bookingId: true,
        vehicleId: true,
        order: { select: { number: true, status: true, total: true, paidAmount: true } },
      },
    });
    if (!job) throw new AppError('أمر الشغل غير موجود');

    /*
      الصبغ الدائم لا يخرج بلا كود لونه — قاعدة الفرع كقاعدة الفاتورة: السيارة
      تعود بعد سنة بخدشٍ في الباب نفسه، وبلا كودٍ تُطابَق بالعين فيختلف اللون.
      والقابل للإزالة يُستثنى: يُنزع ولا يُطابَق عليه.
    */
    if (status === 'DELIVERED') {
      /*
        بندٌ بانتظار التسعير لم يدخل الفاتورة بعد — الفاتورة تتبع المسعَّر
        وحده. فلو خرجت السيارة لخرج شغلُه بلا ثمن وهي «مسدَّدة».
      */
      const unpriced = await db.jobOrderItem.findFirst({
        where: { jobOrderId: id, parentId: null, isPriced: false },
        select: { label: true },
      });
      if (unpriced) {
        throw new AppError(`«${unpriced.label}» بانتظار التسعير — سعّره قبل التسليم`);
      }

      const uncoded = await db.paintDetail.findFirst({
        where: { item: { jobOrderId: id }, type: 'PERMANENT', paintCode: null },
        select: { item: { select: { label: true } } },
      });
      if (uncoded) {
        throw new AppError(
          `«${uncoded.item.label}» بلا كود لون — سجّله قبل التسليم، فالسيارة إن عادت تُخلط لها الخلطة نفسها`
        );
      }
    }

    /*
      السيارة لا تخرج قبل سداد فاتورتها — قاعدة الفرع، فتُحرَس على الخادم
      لا في الواجهة: إخفاء خيارٍ ليس منعاً.

      ولا فاتورةَ يعني لم يُطالَب بشيء بعد، وهي أسوأ من فاتورةٍ معلّقة:
      تلك يُعرف قدرُها، وهذه تخرج السيارة بلا أثرٍ للمال. والملغاة
      والمرتجعة لا تُبرئ ذمّةً لأنها لم تُحصّل.

      والصفرُ سداد: كفالةٌ أو مجاملةٌ تُفوتر بصفرٍ فتخرج سيارتها بلا حرج.
    */
    if (status === 'DELIVERED') {
      const order = job.order;
      if (!order) {
        throw new AppError('لا فاتورة لهذا الأمر — أصدر الفاتورة وحصّلها قبل التسليم');
      }
      if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
        throw new AppError(
          `فاتورة ${order.number} ${order.status === 'CANCELLED' ? 'ملغاة' : 'مرتجعة'} — أصدر فاتورة سارية وحصّلها قبل التسليم`
        );
      }
      const remaining = Number(order.total) - Number(order.paidAmount);
      if (remaining > 0) {
        throw new AppError(
          `متبقٍّ على فاتورة ${order.number} ${remaining.toFixed(3)} د.ك — حصّله قبل التسليم`
        );
      }
    }

    /*
      الطابع يُكتب عند بلوغ الحالة ويُمسح عند التراجع عنها.
      كان يُكتب بـundefined عند غير حالته، وهي في Prisma تعني «لا تغيّر»
      — فأمر عُلّم «مُسلَّم» بالخطأ ثم أُعيد إلى الورشة يحتفظ بتاريخ
      تسليمه إلى الأبد، فيكذب كل تقرير عن أوقات التسليم.
      وعند التقدّم من «جاهز» إلى «مُسلَّم» نُبقي الطابع الأول: لحظة
      الجاهزية لا تتغيّر لأن السيارة سُلّمت.
    */
    const done = status === 'READY' || status === 'DELIVERED';

    /*
      الحجز يتبع أمرَه.

      كان يُعلَّم «قيد التنفيذ» لحظة تحويله ثم لا يعود إليه أحد، فتُسلَّم
      السيارة ويبقى حجزُها يقول إن الشغل جارٍ — فيظهر في ملف العميل «تم
      التسليم» و«قيد التنفيذ» في سطرين متجاورين عن الشيء نفسه.

      والحجز طلبُ موعد: متى صار أمر شغل انتهى دوره، وصارت حقيقةُ العمل
      عند الأمر لا عنده. فيتبعه: يُنهى بتسليمه، ويُلغى بإلغائه، ويعود
      «قيد التنفيذ» إن رجع الأمر إلى الورشة — فالتراجع يُصلح ما أفسده
      التقدّمُ الخاطئ.
    */
    const bookingStatus =
      status === 'DELIVERED' ? 'COMPLETED' : status === 'CANCELLED' ? 'CANCELLED' : 'IN_PROGRESS';

    await db.$transaction(async (tx) => {
      await tx.jobOrder.update({
        where: { id },
        data: {
          status,
          completedAt: done ? (job.completedAt ?? new Date()) : null,
          deliveredAt:
            status === 'DELIVERED' ? (job.deliveredAt ?? new Date()) : null,
        },
      });

      if (job.bookingId) {
        await tx.booking.update({
          where: { id: job.bookingId },
          data: { status: bookingStatus },
        });
      }

      /*
        تغيير اللون يصير لون السيارة لحظة تسليمها — في الحفظة نفسها، فلا
        تخرج السيارة بلونٍ ويبقى ملفّها على القديم.
      */
      if (status === 'DELIVERED' && job.vehicleId) {
        const recolor = await tx.paintDetail.findFirst({
          where: { item: { jobOrderId: id }, scope: 'FULL' },
          orderBy: { createdAt: 'desc' },
          select: { colorName: true, paintCode: true },
        });
        if (recolor && (recolor.colorName || recolor.paintCode)) {
          await tx.vehicle.update({
            where: { id: job.vehicleId },
            data: {
              ...(recolor.colorName ? { color: recolor.colorName } : {}),
              ...(recolor.paintCode ? { paintCode: recolor.paintCode } : {}),
            },
          });
        }
      }
    });

    revalidatePath('/dashboard/job-orders');
    revalidatePath(`/dashboard/job-orders/${id}`);
    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/customers');
    return { id, message: 'تم تحديث حالة أمر الشغل' };
  },
});

export const deleteJobItem = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string(), jobOrderId: z.string() }),
  audit: { entity: 'JobOrderItem', action: 'DELETE' },
  handler: async ({ id, jobOrderId }) => {
    await assertItemInJob(id, jobOrderId);
    await assertJobOpen(jobOrderId);

    const invoice = await db.$transaction(async (tx) => {
      await tx.jobOrderItem.delete({ where: { id } });
      return syncJobInvoice(tx, jobOrderId);
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidateInvoice(invoice);
    return { id, message: invoice ? 'تم حذف البند وتحديث الفاتورة' : 'تم حذف البند' };
  },
});

/**
 * إصدار فاتورة أمر الشغل — بخصمها ودفعتها الأولى في خطوة واحدة.
 *
 * كان الإصدار زرّاً يولّد فاتورة معلّقة، ثم يُفتح الخصم في نافذة والتحصيل
 * في أخرى — والعميل واقفٌ عند الاستقبال. والعربون ليس نظاماً آخر: الفاتورة
 * تتبع الأمر حتى التسليم، فتُصدر عند الاستلام ويُقيَّد العربون دفعةً أولى
 * عليها.
 */
export const createInvoiceFromJob = action({
  permission: 'pos:write',
  schema: z.object({
    jobOrderId: z.string(),
    discountAmount: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0).default(0),
    discountNote: optionalString.optional(),
    /** دفعة عند الإصدار — عربونٌ أو المبلغ كلّه. الآجل ليس دفعة: الفاتورة بلا دفعة آجلةٌ أصلاً */
    payment: z
      .object({
        method: z.enum(['CASH', 'KNET', 'VISA', 'TRANSFER', 'LINK']),
        amount: z.union([z.string(), z.number()]).transform(Number),
        reference: optionalString,
      })
      .nullish(),
  }),
  audit: { entity: 'Order', action: 'FROM_JOB' },
  handler: async ({ jobOrderId, discountAmount, discountNote, payment }, { userId }) => {
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      throw new AppError('قيمة الخصم غير صالحة');
    }
    if (payment && (!Number.isFinite(payment.amount) || payment.amount <= 0)) {
      throw new AppError('مبلغ الدفعة يجب أن يكون أكبر من صفر');
    }

    const job = await db.jobOrder.findUnique({
      where: { id: jobOrderId },
      // محتويات الباقات بنود متابعة داخلية بصفر — الفاتورة تأخذ الآباء فقط
      include: {
        items: { where: { parentId: null }, include: { paint: { select: { id: true } } } },
        order: true,
      },
    });

    if (!job) throw new AppError('أمر الشغل غير موجود');
    if (job.order) throw new AppError('توجد فاتورة مرتبطة بأمر الشغل بالفعل');
    if (job.items.length === 0) throw new AppError('لا يمكن إصدار فاتورة بدون بنود');

    // صفرُ بندٍ لم يُسعَّر ليس مجاناً — فاتورةٌ به تُسقط ثمن الشغل بصمت
    const unpriced = job.items.find((i) => !i.isPriced);
    if (unpriced) {
      throw new AppError(`«${unpriced.label}» بانتظار التسعير — سعّره قبل إصدار الفاتورة`);
    }

    // الدفعة تُحسب في درج وردية من قبضها — كالتحصيل تماماً
    const session = payment
      ? await db.registerSession.findFirst({
          where: { openedById: userId, closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        })
      : null;

    const order = await db.$transaction(async (tx) => {
      // البنود بمنشئ المزامنة نفسه — فالفاتورة تولد كما ستبقى
      const lines = await invoiceLinesOf(job.id, tx);
      const subtotal = fils(lines.reduce((sum, i) => sum + Number(i.total), 0));

      const discount = fils(discountAmount);
      if (discount > subtotal) throw new AppError('الخصم أكبر من قيمة الفاتورة');
      const total = fils(subtotal - discount);

      const paid = payment ? fils(payment.amount) : 0;
      if (paid > total) {
        throw new AppError(`الدفعة أكبر من إجمالي الفاتورة ${total.toFixed(3)} د.ك`);
      }

      // الرقم بعد التحقّق: إصدارٌ مرفوض لا يُسقط رقماً من التسلسل
      const number = await nextNumber('invoice');
      return tx.order.create({
        data: {
          number,
          channel: 'INVOICE',
          // الصفرُ سداد: كفالةٌ أو مجاملةٌ بصفر لا تنتظر تحصيلاً
          status: paid >= total ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'DRAFT',
          customerId: job.customerId,
          jobOrderId: job.id,
          cashierId: userId,
          subtotal,
          discountAmount: discount,
          // سببٌ بلا خصم لا يُطبع — لا معنى لـ«عميل دائم» بجانب صفر
          discountNote: discount > 0 ? (discountNote ?? null) : null,
          total,
          paidAmount: paid,
          ...(payment && {
            payments: {
              create: {
                method: payment.method,
                amount: paid,
                reference: payment.reference,
                registerSessionId: session?.id ?? null,
              },
            },
          }),
          items: {
            create: lines.map((i) => ({
              productId: i.productId,
              label: invoiceLineLabel(i),
              qty: i.qty,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
        },
      });
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidatePath('/dashboard/job-orders');
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/customers/${job.customerId}`);
    revalidatePath('/dashboard');
    const paid = Number(order.paidAmount);
    return {
      id: order.id,
      message:
        paid > 0
          ? `صدرت الفاتورة ${order.number} وحُصِّل ${paid.toFixed(3)} د.ك`
          : `صدرت الفاتورة ${order.number}`,
    };
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
    /** الأجزاء المكفولة — قطع الحماية أو لوحات الصبغ ورنقاته؛ فارغة تعني الموضوع كلّه */
    parts: z.array(z.string()).default([]),
    terms: optionalString,
  }),
  audit: { entity: 'Warranty', action: 'ISSUE' },
  handler: async ({ jobOrderId, subject, months, parts, terms }) => {
    if (!Number.isFinite(months) || months <= 0) throw new AppError('مدة الكفالة غير صالحة');

    const def = warrantySubject(subject);
    if (!def) throw new AppError('موضوع كفالة غير معروف');

    // الأجزاء لا معنى لها إلا حيث تُركَّب قطعةً قطعة
    const covered = warrantyHasParts(subject) ? [...new Set(parts)] : [];
    if (covered.some((k) => !warrantyPartValid(subject, k))) {
      throw new AppError('جزء غير معروف في قائمة الأجزاء');
    }

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
        parts: covered,
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
  /** لم يُسعَّر بعد — الصبغ وحده يُستلم قبل معاينته */
  unpriced: z.boolean().default(false),
  /** القطع: اسمها ومفتاحها ومواصفتها (درجة العازل) ومن يشتغل عليها */
  parts: z
    .array(
      z.object({
        key: optionalString,
        label: z.string().min(1),
        spec: optionalString,
        employeeIds: z.array(z.string()).default([]),
      })
    )
    .default([]),
  /** بند الصبغ: ما يُقرأ عند عودة السيارة — يُحفظ في PaintDetail لا نصّاً */
  paint: z
    .object({
      scope: z.enum(['PARTS', 'RIMS', 'FULL']),
      type: z.enum(['PERMANENT', 'REMOVABLE']),
      finish: z.enum(['GLOSS', 'MATTE', 'SATIN']),
      parts: z.array(z.string()).default([]),
      rimCount: z.union([z.string(), z.number()]).nullish(),
      colorName: optionalString,
      paintCode: optionalString,
      formula: optionalString,
      repairNotes: optionalString,
    })
    .nullish(),
});

type IntakeLine = z.infer<typeof intakeLineSchema>;

/** السعر صالح — أو غائبٌ عمداً في بندٍ بانتظار التسعير */
function assertLinePrice(line: IntakeLine) {
  if (line.unpriced) return;
  if (!Number.isFinite(line.price) || line.price < 0) {
    throw new AppError('سعر غير صالح — الصفر يعني «ضمن الباقة»');
  }
}

/**
 * بند الصبغ وقطعه.
 *
 * القطع تُشتقّ على الخادم من النطاق لا تُقبل من الطلب: «سيارة كاملة» تعني
 * اللوحات كلّها، و«رنقات» قطعةٌ واحدة بعددها. والبند يُربط بخدمة الصبغ
 * في جدول الخدمات — كان يُترك بلا خدمة لأن الربط كان للماركات وحدها.
 */
async function createPaintLine(
  tx: Prisma.TransactionClient,
  jobOrderId: string,
  service: IntakeService,
  line: IntakeLine
) {
  const paint = line.paint;
  if (!paint) throw new AppError('حدّد نطاق الصبغ ونوعه');

  const parts =
    paint.scope === 'FULL'
      ? PAINT_PARTS.map((part) => part.key as string)
      : paint.scope === 'PARTS'
        ? [...new Set(paint.parts)]
        : [];
  if (paint.scope === 'PARTS') {
    if (parts.length === 0) throw new AppError('اختر القطع المصبوغة');
    if (parts.some((key) => !PAINT_PART_KEYS.has(key))) {
      throw new AppError('قطعة غير معروفة في قطع الصبغ');
    }
  }

  const rimCount = paint.scope === 'RIMS' ? Number(paint.rimCount) : null;
  if (
    paint.scope === 'RIMS' &&
    !(rimCount !== null && Number.isInteger(rimCount) && rimCount >= 1 && rimCount <= 4)
  ) {
    throw new AppError('عدد الرنقات من 1 إلى 4');
  }

  const paintService = service.slug
    ? await tx.service.findUnique({ where: { slug: service.slug }, select: { id: true } })
    : null;
  const price = line.unpriced ? 0 : fils(line.price);

  const parent = await tx.jobOrderItem.create({
    data: {
      jobOrderId,
      label: paintLabel(paint.type, paint.scope),
      serviceId: paintService?.id ?? null,
      spec: paintSpec(paint.finish, paint.paintCode) || null,
      qty: 1,
      unitPrice: price,
      total: price,
      isPriced: !line.unpriced,
      paint: {
        create: {
          scope: paint.scope,
          type: paint.type,
          finish: paint.finish,
          colorName: paint.colorName ?? null,
          paintCode: paint.paintCode ?? null,
          formula: paint.formula ?? null,
          rimCount,
          repairNotes: paint.repairNotes ?? null,
        },
      },
    },
  });

  if (paint.scope === 'RIMS' && rimCount !== null) {
    await tx.jobOrderItem.create({
      data: {
        jobOrderId,
        parentId: parent.id,
        label: `الرنقات (${rimCount})`,
        partKey: RIMS_PART_KEY,
        qty: rimCount,
        unitPrice: 0,
        total: 0,
      },
    });
  } else {
    await tx.jobOrderItem.createMany({
      data: parts.map((key) => ({
        jobOrderId,
        parentId: parent.id,
        label: paintPartLabel(key),
        partKey: key,
        qty: 1,
        unitPrice: 0,
        total: 0,
      })),
    });
  }

  return parent;
}

/**
 * كود اللون يُحفظ على السيارة أول ما يُعرف — من صبغ قطعةٍ طابقت لونها.
 * الصبغ الكامل لا يُعتمد هنا: لونه الجديد لم يُطبَّق بعد، ويُكتب عند التسليم.
 */
async function adoptPaintCode(tx: Prisma.TransactionClient, jobOrderId: string) {
  const job = await tx.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { vehicleId: true, vehicle: { select: { paintCode: true } } },
  });
  if (!job?.vehicleId || job.vehicle?.paintCode) return;

  const detail = await tx.paintDetail.findFirst({
    where: { item: { jobOrderId }, scope: { not: 'FULL' }, paintCode: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { paintCode: true },
  });
  if (detail?.paintCode) {
    await tx.vehicle.update({ where: { id: job.vehicleId }, data: { paintCode: detail.paintCode } });
  }
}

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
  if (service.paint) return createPaintLine(tx, jobOrderId, service, line);
  if (line.unpriced) throw new AppError('التسعير بعد المعاينة للصبغ وحده — اكتب سعر البند');

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
        partKey: part.key ?? null,
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
    assertLinePrice(line);
    await assertJobOpen(jobOrderId);

    const invoice = await db.$transaction(async (tx) => {
      await createJobLine(tx, jobOrderId, line);
      await adoptPaintCode(tx, jobOrderId);
      return syncJobInvoice(tx, jobOrderId);
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidateInvoice(invoice);
    return {
      id: jobOrderId,
      message: invoice ? 'تمت إضافة البند إلى الأمر وفاتورته' : 'تمت إضافة البند',
    };
  },
});

/**
 * «تسعير البند» — بعد المعاينة، أو تصحيح سعرٍ حتى التسليم.
 *
 * كان يُمنع بعد الفاتورة ويُحال إليها، والفاتورة لا تعرف إلا الخصم — فسعرٌ
 * كُتب أقلّ من حقّه لا يُصحَّح أبداً. صارت الفاتورة تتبع البند، فيُصحَّح
 * هنا وتتبعه في المعاملة نفسها.
 *
 * وموافقة العميل تُسجَّل ولا تمنع — وإعادة التسعير تمسحها، فالموافقة على
 * سعرٍ لا تنتقل إلى سعرٍ غيره.
 */
export const setItemPrice = action({
  permission: 'workshop:write',
  schema: z.object({
    itemId: z.string(),
    jobOrderId: z.string(),
    price: z.union([z.string(), z.number()]).transform(Number),
    approved: z.boolean().default(false),
    method: z.enum(['CALL', 'WHATSAPP', 'IN_PERSON']).nullish(),
    note: optionalString,
  }),
  audit: { entity: 'JobOrderItem', action: 'PRICE' },
  handler: async ({ itemId, jobOrderId, price, approved, method, note }) => {
    if (!Number.isFinite(price) || price < 0) throw new AppError('سعر غير صالح');
    if (approved && !method) throw new AppError('اختر كيف وافق العميل');

    await assertItemInJob(itemId, jobOrderId);
    await assertJobOpen(jobOrderId);
    const item = await db.jobOrderItem.findUnique({
      where: { id: itemId },
      select: { parentId: true },
    });
    if (!item) throw new AppError('البند غير موجود');
    if (item.parentId) throw new AppError('السعر للبند لا لقطعه');

    const value = fils(price);
    const invoice = await db.$transaction(async (tx) => {
      await tx.jobOrderItem.update({
        where: { id: itemId },
        data: {
          unitPrice: value,
          total: value,
          isPriced: true,
          priceApprovedAt: approved ? new Date() : null,
          priceApprovalMethod: approved ? method : null,
          priceApprovalNote: approved ? (note ?? null) : null,
        },
      });
      return syncJobInvoice(tx, jobOrderId);
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidateInvoice(invoice);
    return { id: itemId, message: invoice ? 'تم تسعير البند وتحديث الفاتورة' : 'تم تسعير البند' };
  },
});

/**
 * تصحيح سجلّ الصبغ — حتى تسليم السيارة.
 *
 * الكود والخلطة كثيراً ما تُعرف بعد الاستلام، عند خلط اللون فعلاً. وبعد
 * التسليم يصير السجلّ تاريخاً: ما خُلط للسيارة يومها لا يُعاد كتابته.
 * والنطاق والنوع لا يُصحَّحان هنا — هما شكل البند وقطعه، ويُصحَّحان بحذفه.
 */
export const updatePaintDetail = action({
  permission: 'workshop:write',
  schema: z.object({
    itemId: z.string(),
    jobOrderId: z.string(),
    finish: z.enum(['GLOSS', 'MATTE', 'SATIN']),
    colorName: optionalString,
    paintCode: optionalString,
    formula: optionalString,
    repairNotes: optionalString,
  }),
  audit: { entity: 'PaintDetail', action: 'UPDATE' },
  handler: async ({ itemId, jobOrderId, finish, colorName, paintCode, formula, repairNotes }) => {
    await assertItemInJob(itemId, jobOrderId);
    const item = await db.jobOrderItem.findUnique({
      where: { id: itemId },
      select: { paint: { select: { id: true } }, jobOrder: { select: { status: true } } },
    });
    if (!item?.paint) throw new AppError('البند ليس بند صبغ');
    if (item.jobOrder.status === 'DELIVERED') {
      throw new AppError('سُلّمت السيارة — سجلّ الصبغ صار تاريخاً لا يُعدَّل');
    }

    // التشطيب والكود في نصّ بند الفاتورة — فتتبعهما
    const invoice = await db.$transaction(async (tx) => {
      await tx.paintDetail.update({
        where: { itemId },
        data: {
          finish,
          colorName: colorName ?? null,
          paintCode: paintCode ?? null,
          formula: formula ?? null,
          repairNotes: repairNotes ?? null,
        },
      });
      await tx.jobOrderItem.update({
        where: { id: itemId },
        data: { spec: paintSpec(finish, paintCode) || null },
      });
      await adoptPaintCode(tx, jobOrderId);
      return syncJobInvoice(tx, jobOrderId);
    });

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    revalidateInvoice(invoice);
    return { id: itemId, message: 'تم حفظ سجلّ الصبغ' };
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

    for (const line of input.lines) assertLinePrice(line);

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
      await adoptPaintCode(tx, created.id);

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
    const select = {
      id: true,
      make: true,
      model: true,
      customerId: true,
      customer: { select: { name: true } },
    } satisfies Prisma.VehicleSelect;

    let vehicle = await db.vehicle.findUnique({
      where: { plateNo: plateNo.trim() },
      select,
    });

    /*
      «10-83538» تُخزَّن بشرطتها، فالمطابقة التامّة وحدها تُخفيها عن من
      كتبها بمسافة. والتوحيد يجري على الطرفين في vehicleIdsByPlate، فتُجمع
      صور اللوحة الواحدة. ولا يُقبل إلا مرشّحٌ واحد: «123» تطابق «91234»
      أيضاً، ومطابقةٌ خاطئة هنا تدعو الموظف إلى نقل ملكية سيارةٍ أخرى.
    */
    const normalized = normalizePlate(plateNo);
    if (!vehicle && normalized) {
      const candidates = await vehicleIdsByPlate(plateNo, 2);
      if (candidates.length === 1) {
        vehicle = await db.vehicle.findUnique({ where: { id: candidates[0] }, select });
      }
    }

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
  // القائمة تخدم بيان التشغيل وعقد الغسيل؛ كل وحدة تجيزها بصلاحيتها وحدها
  permission: ['workshop:read', 'wash:read'],
  schema: z.object({ customerId: z.string().min(1) }),
  handler: async ({ customerId }) => {
    const vehicles = await db.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, make: true, model: true, year: true, plateNo: true, paintCode: true },
    });

    return {
      data: {
        vehicles: vehicles.map((v) => ({
          id: v.id,
          label: `${v.make} ${v.model}${v.year ? ` — ${v.year}` : ''}`,
          plateNo: v.plateNo,
          paintCode: v.paintCode,
        })),
      },
    };
  },
});
