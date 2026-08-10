'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { action, optionalString } from '@/lib/action-utils';

function fils(n: number) {
  return Math.round(n * 1000) / 1000;
}

export const createJobOrder = action({
  permission: 'workshop:write',
  schema: z.object({
    customerId: z.string().min(1, 'العميل مطلوب'),
    vehicleId: optionalString,
    odometer: optionalString,
    promisedAt: optionalString,
    intakeNotes: optionalString,
    notes: optionalString,
  }),
  audit: { entity: 'JobOrder', action: 'CREATE' },
  handler: async (input) => {
    const job = await db.jobOrder.create({
      data: {
        number: await nextNumber('job'),
        customerId: input.customerId,
        vehicleId: input.vehicleId || null,
        odometer: input.odometer ? Number(input.odometer) : null,
        promisedAt: input.promisedAt ? new Date(input.promisedAt) : null,
        intakeNotes: input.intakeNotes,
        notes: input.notes,
      },
    });

    revalidatePath('/dashboard/job-orders');
    return { id: job.id, message: `تم إنشاء أمر الشغل ${job.number}` };
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
    await db.jobOrder.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'READY' ? new Date() : undefined,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    });

    revalidatePath('/dashboard/job-orders');
    revalidatePath(`/dashboard/job-orders/${id}`);
    return { id, message: 'تم تحديث حالة أمر الشغل' };
  },
});

export const saveJobItem = action({
  permission: 'workshop:write',
  schema: z.object({
    id: z.string().optional(),
    jobOrderId: z.string(),
    productId: optionalString,
    serviceId: optionalString,
    label: z.string().trim().min(1, 'وصف البند مطلوب'),
    qty: z.union([z.string(), z.number()]).transform(Number),
    unitPrice: z.union([z.string(), z.number()]).transform(Number),
  }),
  audit: { entity: 'JobOrderItem', action: 'SAVE' },
  handler: async ({ id, jobOrderId, productId, serviceId, label, qty, unitPrice }) => {
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية غير صالحة');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('السعر غير صالح');

    const data = {
      jobOrderId,
      productId: productId || null,
      serviceId: serviceId || null,
      label,
      qty,
      unitPrice,
      total: fils(qty * unitPrice),
    };

    if (id) {
      await db.jobOrderItem.update({ where: { id }, data });
    } else {
      await db.jobOrderItem.create({ data });
    }

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id, message: 'تم حفظ البند' };
  },
});

export const deleteJobItem = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string(), jobOrderId: z.string() }),
  audit: { entity: 'JobOrderItem', action: 'DELETE' },
  handler: async ({ id, jobOrderId }) => {
    await db.jobOrderItem.delete({ where: { id } });
    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id, message: 'تم حذف البند' };
  },
});

export const toggleJobItemDone = action({
  permission: 'workshop:write',
  schema: z.object({ id: z.string(), jobOrderId: z.string(), isDone: z.boolean() }),
  handler: async ({ id, jobOrderId, isDone }) => {
    await db.jobOrderItem.update({ where: { id }, data: { isDone } });
    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id };
  },
});

export const assignTechnician = action({
  permission: 'workshop:write',
  schema: z.object({
    jobOrderId: z.string(),
    employeeId: z.string(),
    remove: z.boolean().default(false),
  }),
  audit: { entity: 'JobOrderAssignee', action: 'ASSIGN' },
  handler: async ({ jobOrderId, employeeId, remove }) => {
    if (remove) {
      await db.jobOrderAssignee.delete({
        where: { jobOrderId_employeeId: { jobOrderId, employeeId } },
      });
    } else {
      await db.jobOrderAssignee.upsert({
        where: { jobOrderId_employeeId: { jobOrderId, employeeId } },
        create: { jobOrderId, employeeId },
        update: {},
      });
    }

    revalidatePath(`/dashboard/job-orders/${jobOrderId}`);
    return { id: jobOrderId, message: remove ? 'تم إلغاء الإسناد' : 'تم إسناد الفني' };
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
      include: { items: true, order: true },
    });

    if (!job) throw new Error('أمر الشغل غير موجود');
    if (job.order) throw new Error('توجد فاتورة مرتبطة بأمر الشغل بالفعل');
    if (job.items.length === 0) throw new Error('لا يمكن إصدار فاتورة بدون بنود');

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
    serviceId: optionalString,
    months: z.union([z.string(), z.number()]).transform(Number),
    terms: optionalString,
  }),
  audit: { entity: 'Warranty', action: 'ISSUE' },
  handler: async ({ jobOrderId, serviceId, months, terms }) => {
    if (!Number.isFinite(months) || months <= 0) throw new Error('مدة الكفالة غير صالحة');

    const job = await db.jobOrder.findUnique({ where: { id: jobOrderId } });
    if (!job) throw new Error('أمر الشغل غير موجود');
    if (!job.vehicleId) throw new Error('لا يمكن إصدار كفالة بدون سيارة مرتبطة');

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const warranty = await db.warranty.create({
      data: {
        certificateNo: await nextNumber('warranty'),
        vehicleId: job.vehicleId,
        serviceId: serviceId || null,
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
