'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { action, moneySchema, optionalDate, optionalString, phoneSchema } from '@/lib/action-utils';
import { dateOnlyFromInput, todayDateOnly } from '@/lib/utils';
// نشتق قوائم القيم من enums بريزما مباشرة — تكرارها يدوياً يجعلها تنحرف بصمت
import {
  AttendanceStatus,
  DocumentType,
  EmployeeStatus,
  LeaveType,
  PayrollStatus,
} from '@/generated/prisma/enums';

// ═══════════════════════════════════════════════════════════
//  الموظفون
// ═══════════════════════════════════════════════════════════

const employeeSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, 'اسم الموظف مطلوب'),
  fullNameEn: optionalString,
  position: z.string().trim().min(2, 'المسمى الوظيفي مطلوب'),
  departmentId: optionalString,
  phone: phoneSchema,
  email: z.union([z.string().email('البريد الإلكتروني غير صالح'), z.literal('')]).optional(),
  nationality: optionalString,
  civilId: optionalString,
  birthDate: optionalDate,
  hireDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  contractEnd: optionalDate,
  sponsor: optionalString,
  photo: optionalString,
  status: z.enum(EmployeeStatus),
  baseSalary: moneySchema,
  allowance: moneySchema,
  bankName: optionalString,
  bankAccount: optionalString,
  bankIban: optionalString,
  emergencyContact: optionalString,
  annualLeaveDays: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v) || 30)
    .refine((n) => n >= 0 && n <= 365, 'عدد أيام الإجازة غير منطقي'),
  notes: optionalString,
});

export const saveEmployee = action({
  permission: 'hr:write',
  schema: employeeSchema,
  audit: { entity: 'Employee', action: 'SAVE' },
  handler: async (input) => {
    const { id, email, ...rest } = input;
    const data = { ...rest, email: email || null };

    if (id) {
      const updated = await db.employee.update({ where: { id }, data });
      revalidatePath('/dashboard/hr/employees');
      revalidatePath(`/dashboard/hr/employees/${id}`);
      return { id: updated.id, message: 'تم تحديث بيانات الموظف' };
    }

    const created = await db.employee.create({
      data: { ...data, code: await nextNumber('employee', 3) },
    });
    revalidatePath('/dashboard/hr/employees');
    return { id: created.id, message: `تمت إضافة الموظف ${created.code}` };
  },
});

export const deleteEmployee = action({
  permission: 'hr:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'Employee', action: 'DELETE' },
  handler: async ({ id }) => {
    const payslips = await db.payslip.count({ where: { employeeId: id } });
    if (payslips > 0) {
      throw new Error('لا يمكن حذف موظف له مسيّرات رواتب — غيّر حالته إلى "منتهي الخدمة"');
    }
    await db.employee.delete({ where: { id } });
    revalidatePath('/dashboard/hr/employees');
    return { id, message: 'تم حذف الموظف' };
  },
});

// ═══════════════════════════════════════════════════════════
//  الحضور والانصراف
// ═══════════════════════════════════════════════════════════

/** يحسب دقائق التأخير مقارنة ببداية الدوام المُعرّفة في الإعدادات */
async function computeLateMinutes(checkIn: Date): Promise<number> {
  const [startSetting, graceSetting] = await Promise.all([
    db.siteSetting.findUnique({ where: { key: 'hr.workDayStart' } }),
    db.siteSetting.findUnique({ where: { key: 'hr.lateGraceMins' } }),
  ]);

  const startStr = (startSetting?.value as string) ?? '10:00';
  const grace = Number(graceSetting?.value ?? 15);
  const [h, m] = startStr.split(':').map(Number);

  const expected = new Date(checkIn);
  expected.setHours(h, m, 0, 0);

  const diffMins = Math.round((checkIn.getTime() - expected.getTime()) / 60000);
  return diffMins > grace ? diffMins : 0;
}

const attendanceSchema = z.object({
  employeeId: z.string().min(1, 'الموظف مطلوب'),
  date: z
    .union([z.string(), z.date()])
    .transform((v) => (v instanceof Date ? v : dateOnlyFromInput(v))),
  checkIn: optionalString,
  checkOut: optionalString,
  status: z.enum(AttendanceStatus),
  notes: optionalString,
});

export const saveAttendance = action({
  permission: 'hr:write',
  schema: attendanceSchema,
  audit: { entity: 'Attendance', action: 'SAVE' },
  handler: async ({ employeeId, date, checkIn, checkOut, status, notes }) => {
    /** يدمج وقت "HH:mm" مع تاريخ اليوم */
    const withTime = (time: string | null | undefined) => {
      if (!time) return null;
      const [h, m] = time.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      const d = new Date(date);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const inAt = withTime(checkIn);
    const outAt = withTime(checkOut);

    if (inAt && outAt && outAt <= inAt) {
      throw new Error('وقت الانصراف يجب أن يكون بعد وقت الحضور');
    }

    const lateMins = inAt ? await computeLateMinutes(inAt) : 0;
    const overtimeMins =
      inAt && outAt ? Math.max(0, Math.round((outAt.getTime() - inAt.getTime()) / 60000) - 600) : 0;

    const data = {
      checkIn: inAt,
      checkOut: outAt,
      status: status === 'PRESENT' && lateMins > 0 ? ('LATE' as const) : status,
      lateMins,
      overtimeMins,
      notes,
    };

    const record = await db.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: data,
      create: { employeeId, date, ...data },
    });

    revalidatePath('/dashboard/hr/attendance');
    return { id: record.id, message: 'تم حفظ سجل الحضور' };
  },
});

/** تسجيل حضور سريع للحظة الحالية */
export const quickCheck = action({
  permission: 'hr:write',
  schema: z.object({ employeeId: z.string(), kind: z.enum(['IN', 'OUT']) }),
  audit: { entity: 'Attendance', action: 'QUICK_CHECK' },
  handler: async ({ employeeId, kind }) => {
    const now = new Date();
    const date = todayDateOnly();

    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });

    if (kind === 'IN') {
      if (existing?.checkIn) throw new Error('تم تسجيل الحضور لهذا اليوم مسبقاً');
      const lateMins = await computeLateMinutes(now);
      const record = await db.attendance.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { checkIn: now, lateMins, status: lateMins > 0 ? 'LATE' : 'PRESENT' },
        create: {
          employeeId,
          date,
          checkIn: now,
          lateMins,
          status: lateMins > 0 ? 'LATE' : 'PRESENT',
        },
      });
      revalidatePath('/dashboard/hr/attendance');
      return {
        id: record.id,
        message: lateMins > 0 ? `تم تسجيل الحضور — تأخير ${lateMins} دقيقة` : 'تم تسجيل الحضور',
      };
    }

    if (!existing?.checkIn) throw new Error('لا يوجد تسجيل حضور لهذا اليوم');
    if (existing.checkOut) throw new Error('تم تسجيل الانصراف مسبقاً');

    const worked = Math.round((now.getTime() - existing.checkIn.getTime()) / 60000);
    const record = await db.attendance.update({
      where: { id: existing.id },
      data: { checkOut: now, overtimeMins: Math.max(0, worked - 600) },
    });

    revalidatePath('/dashboard/hr/attendance');
    return { id: record.id, message: 'تم تسجيل الانصراف' };
  },
});

// ═══════════════════════════════════════════════════════════
//  الإجازات
// ═══════════════════════════════════════════════════════════

const leaveSchema = z
  .object({
    id: z.string().optional(),
    employeeId: z.string().min(1, 'الموظف مطلوب'),
    type: z.enum(LeaveType),
    fromDate: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : dateOnlyFromInput(v))),
    toDate: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : dateOnlyFromInput(v))),
    reason: optionalString,
  })
  .refine((d) => d.toDate >= d.fromDate, {
    message: 'تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية',
    path: ['toDate'],
  });

export const saveLeave = action({
  permission: 'hr:write',
  schema: leaveSchema,
  audit: { entity: 'LeaveRequest', action: 'SAVE' },
  handler: async ({ id, employeeId, type, fromDate, toDate, reason }) => {
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

    // تحقق من رصيد الإجازة السنوية
    if (type === 'ANNUAL') {
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { annualLeaveDays: true },
      });

      const year = fromDate.getFullYear();
      const used = await db.leaveRequest.aggregate({
        _sum: { days: true },
        where: {
          employeeId,
          type: 'ANNUAL',
          status: 'APPROVED',
          fromDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          ...(id ? { NOT: { id } } : {}),
        },
      });

      const balance = (employee?.annualLeaveDays ?? 30) - (used._sum.days ?? 0);
      if (days > balance) {
        throw new Error(`الرصيد المتبقي ${balance} يوم فقط — الطلب ${days} يوم`);
      }
    }

    const data = { employeeId, type, fromDate, toDate, days, reason };

    if (id) {
      const updated = await db.leaveRequest.update({ where: { id }, data });
      revalidatePath('/dashboard/hr/leaves');
      return { id: updated.id, message: 'تم تحديث طلب الإجازة' };
    }

    const created = await db.leaveRequest.create({ data });
    revalidatePath('/dashboard/hr/leaves');
    return { id: created.id, message: `تم تسجيل طلب إجازة ${days} يوم` };
  },
});

export const decideLeave = action({
  permission: 'hr:write',
  schema: z.object({
    id: z.string(),
    status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
    decisionNote: optionalString,
  }),
  audit: { entity: 'LeaveRequest', action: 'DECIDE' },
  handler: async ({ id, status, decisionNote }, { userId }) => {
    const leave = await db.leaveRequest.update({
      where: { id },
      data: { status, decisionNote, approverId: userId, decidedAt: new Date() },
    });

    // عند الموافقة: نسجّل أيام الإجازة في الحضور تلقائياً
    if (status === 'APPROVED') {
      // نتنقّل بين الأيام بـ UTC لأن fromDate/toDate من نوع @db.Date
      const days: Date[] = [];
      for (
        let d = new Date(leave.fromDate);
        d <= leave.toDate;
        d = new Date(d.getTime() + 86400000)
      ) {
        days.push(new Date(d));
      }

      await Promise.all(
        days.map((date) =>
          db.attendance.upsert({
            where: { employeeId_date: { employeeId: leave.employeeId, date } },
            update: { status: 'ON_LEAVE' },
            create: { employeeId: leave.employeeId, date, status: 'ON_LEAVE' },
          })
        )
      );
    }

    revalidatePath('/dashboard/hr/leaves');
    revalidatePath('/dashboard/hr/attendance');
    const labels = { APPROVED: 'تمت الموافقة', REJECTED: 'تم الرفض', CANCELLED: 'تم الإلغاء' };
    return { id, message: `${labels[status]} على طلب الإجازة` };
  },
});

// ═══════════════════════════════════════════════════════════
//  المستندات
// ═══════════════════════════════════════════════════════════

const documentSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1, 'الموظف مطلوب'),
  type: z.enum(DocumentType),
  number: optionalString,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  fileUrl: optionalString,
  notes: optionalString,
});

export const saveDocument = action({
  permission: 'hr:write',
  schema: documentSchema,
  audit: { entity: 'EmployeeDocument', action: 'SAVE' },
  handler: async ({ id, ...data }) => {
    if (data.issueDate && data.expiryDate && data.expiryDate <= data.issueDate) {
      throw new Error('تاريخ انتهاء المستند يجب أن يكون بعد تاريخ الإصدار');
    }

    if (id) {
      await db.employeeDocument.update({ where: { id }, data });
      revalidatePath(`/dashboard/hr/employees/${data.employeeId}`);
      return { id, message: 'تم تحديث المستند' };
    }

    // بدون معرّف: نحدّث الوثيقة القائمة من نفس النوع بدل إنشاء نسخة مكرّرة
    const existing = await db.employeeDocument.findFirst({
      where: { employeeId: data.employeeId, type: data.type },
    });

    if (existing) {
      // لا نمسح القيم القائمة بحقول فارغة قادمة من نموذج مختصر (كتجديد التواريخ)
      const merged = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
      );
      await db.employeeDocument.update({ where: { id: existing.id }, data: merged });
      revalidatePath(`/dashboard/hr/employees/${data.employeeId}`);
      return { id: existing.id, message: 'تم تحديث المستند' };
    }

    const created = await db.employeeDocument.create({ data });
    revalidatePath(`/dashboard/hr/employees/${data.employeeId}`);
    return { id: created.id, message: 'تمت إضافة المستند' };
  },
});

export const deleteDocument = action({
  permission: 'hr:delete',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'EmployeeDocument', action: 'DELETE' },
  handler: async ({ id }) => {
    await db.employeeDocument.delete({ where: { id } });
    return { id, message: 'تم حذف المستند' };
  },
});

// ═══════════════════════════════════════════════════════════
//  الرواتب
// ═══════════════════════════════════════════════════════════

/**
 * ينشئ مسيّر رواتب لشهر محدّد ويحسب قسائم جميع الموظفين النشطين:
 * الأساسي + البدل + بدل الساعات الإضافية − خصم أيام الغياب.
 */
export const generatePayroll = action({
  permission: 'hr:write',
  schema: z.object({
    month: z.union([z.string(), z.number()]).transform(Number),
    year: z.union([z.string(), z.number()]).transform(Number),
  }),
  audit: { entity: 'PayrollRun', action: 'GENERATE' },
  handler: async ({ month, year }) => {
    if (month < 1 || month > 12) throw new Error('الشهر غير صالح');

    const existing = await db.payrollRun.findUnique({ where: { month_year: { month, year } } });
    if (existing && existing.status !== 'DRAFT') {
      throw new Error('مسيّر هذا الشهر معتمد بالفعل — لا يمكن إعادة توليده');
    }

    const employees = await db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    });

    if (employees.length === 0) throw new Error('لا يوجد موظفون نشطون لتوليد المسيّر');

    // حدود الشهر بـ UTC لتطابق تواريخ الحضور المخزّنة كـ @db.Date
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));
    const workingDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const run = await db.$transaction(async (tx) => {
      const payrollRun = existing
        ? await tx.payrollRun.update({
            where: { id: existing.id },
            data: { totalNet: 0 },
          })
        : await tx.payrollRun.create({ data: { month, year } });

      // نحذف القسائم السابقة عند إعادة التوليد
      await tx.payslip.deleteMany({ where: { payrollRunId: payrollRun.id } });

      let totalNet = 0;

      for (const emp of employees) {
        const [absences, overtime] = await Promise.all([
          tx.attendance.count({
            where: {
              employeeId: emp.id,
              date: { gte: periodStart, lt: periodEnd },
              status: 'ABSENT',
            },
          }),
          tx.attendance.aggregate({
            _sum: { overtimeMins: true },
            where: { employeeId: emp.id, date: { gte: periodStart, lt: periodEnd } },
          }),
        ]);

        const base = Number(emp.baseSalary);
        const allowances = Number(emp.allowance);
        const dailyRate = base / workingDays;
        const hourlyRate = dailyRate / 8;

        const overtimePay =
          Math.round(((overtime._sum.overtimeMins ?? 0) / 60) * hourlyRate * 1.25 * 1000) / 1000;
        const absenceDeduction = Math.round(absences * dailyRate * 1000) / 1000;
        const netPay = Math.round((base + allowances + overtimePay - absenceDeduction) * 1000) / 1000;

        totalNet += netPay;

        const payslip = await tx.payslip.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: emp.id,
            baseSalary: base,
            allowances,
            overtime: overtimePay,
            deductions: absenceDeduction,
            netPay,
            absentDays: absences,
          },
        });

        const items = [
          { type: 'EARNING' as const, label: 'الراتب الأساسي', amount: base },
          ...(allowances > 0
            ? [{ type: 'EARNING' as const, label: 'البدلات', amount: allowances }]
            : []),
          ...(overtimePay > 0
            ? [{ type: 'EARNING' as const, label: 'ساعات إضافية', amount: overtimePay }]
            : []),
          ...(absenceDeduction > 0
            ? [
                {
                  type: 'DEDUCTION' as const,
                  label: `خصم غياب (${absences} يوم)`,
                  amount: absenceDeduction,
                },
              ]
            : []),
        ];

        await tx.payslipItem.createMany({
          data: items.map((i) => ({ ...i, payslipId: payslip.id })),
        });
      }

      return tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalNet: Math.round(totalNet * 1000) / 1000 },
      });
    });

    revalidatePath('/dashboard/hr/payroll');
    return {
      id: run.id,
      message: `تم توليد مسيّر ${month}/${year} لـ ${employees.length} موظف`,
    };
  },
});

export const setPayrollStatus = action({
  permission: 'hr:write',
  schema: z.object({ id: z.string(), status: z.enum(PayrollStatus) }),
  audit: { entity: 'PayrollRun', action: 'STATUS' },
  handler: async ({ id, status }) => {
    await db.payrollRun.update({
      where: { id },
      data: { status, processedAt: status === 'PAID' ? new Date() : null },
    });
    revalidatePath('/dashboard/hr/payroll');
    revalidatePath(`/dashboard/hr/payroll/${id}`);
    const labels = { DRAFT: 'إرجاع إلى مسودة', APPROVED: 'اعتماد', PAID: 'تسجيل صرف' };
    return { id, message: `تم ${labels[status]} المسيّر` };
  },
});

// ═══════════════════════════════════════════════════════════
//  تقييم الأداء
// ═══════════════════════════════════════════════════════════

export const saveReview = action({
  permission: 'hr:write',
  schema: z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1, 'الموظف مطلوب'),
    periodLabel: z.string().trim().min(2, 'فترة التقييم مطلوبة'),
    rating: z
      .union([z.string(), z.number()])
      .transform(Number)
      .refine((n) => n >= 1 && n <= 5, 'التقييم من 1 إلى 5'),
    strengths: optionalString,
    improvements: optionalString,
    goals: optionalString,
  }),
  audit: { entity: 'PerformanceReview', action: 'SAVE' },
  handler: async ({ id, ...data }, { userId }) => {
    if (id) {
      await db.performanceReview.update({ where: { id }, data });
      revalidatePath('/dashboard/hr/reviews');
      return { id, message: 'تم تحديث التقييم' };
    }
    const created = await db.performanceReview.create({ data: { ...data, reviewerId: userId } });
    revalidatePath('/dashboard/hr/reviews');
    return { id: created.id, message: 'تم حفظ التقييم' };
  },
});
