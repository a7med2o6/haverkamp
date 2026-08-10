'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/counters';
import { action, moneySchema, optionalDate, optionalString, phoneSchema } from '@/lib/action-utils';
import { dateOnlyFromInput, todayDateOnly } from '@/lib/utils';
// نشتق قوائم القيم من enums بريزما مباشرة — تكرارها يدوياً يجعلها تنحرف بصمت
import {
  AdvanceStatus,
  AttendanceStatus,
  DocumentType,
  EmployeeStatus,
  LeaveType,
  PayrollStatus,
  PayslipItemType,
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
/**
 * أيام الأسبوع التي يُضاعَف فيها خصم الغياب.
 * الخميس والسبت يحيطان بعطلة الجمعة، فالغياب فيهما يمدّد العطلة عملياً.
 * القيم أرقام getUTCDay: الأحد 0 … السبت 6.
 */
const DAY_INDEX: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

async function getDoubleDeductionDays(): Promise<Set<number>> {
  const setting = await db.siteSetting.findUnique({
    where: { key: 'hr.doubleDeductionDays' },
  });
  const codes = Array.isArray(setting?.value) ? (setting.value as string[]) : ['THU', 'SAT'];
  return new Set(codes.map((c) => DAY_INDEX[c]).filter((n) => n !== undefined));
}

/**
 * ينشئ مسيّر رواتب لشهر محدّد ويحسب قسائم جميع الموظفين النشطين:
 * الأساسي + البدل + بدل الساعات الإضافية − خصم الغياب − أقساط السلف.
 * الغياب في أيام مضاعفة الخصم يُحتسب بيومين.
 * البنود اليدوية (مكافآت/جزاءات) تُحفظ ويُعاد إنشاؤها عند إعادة التوليد.
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

    const doubleDays = await getDoubleDeductionDays();

    // حدود الشهر بـ UTC لتطابق تواريخ الحضور المخزّنة كـ @db.Date
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));
    const workingDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // نحفظ البنود اليدوية قبل حذف القسائم حتى لا تضيع بإعادة التوليد
    const manualItems = existing
      ? await db.payslipItem.findMany({
          where: { isManual: true, payslip: { payrollRunId: existing.id } },
          include: { payslip: { select: { employeeId: true } } },
        })
      : [];

    const manualByEmployee = new Map<string, typeof manualItems>();
    for (const item of manualItems) {
      const list = manualByEmployee.get(item.payslip.employeeId) ?? [];
      list.push(item);
      manualByEmployee.set(item.payslip.employeeId, list);
    }

    const run = await db.$transaction(async (tx) => {
      const payrollRun = existing
        ? await tx.payrollRun.update({ where: { id: existing.id }, data: { totalNet: 0 } })
        : await tx.payrollRun.create({ data: { month, year } });

      // إعادة التوليد تلغي أقساط السلف السابقة لهذا المسيّر ثم تعيد احتسابها
      await tx.advanceRepayment.deleteMany({ where: { payrollRunId: payrollRun.id } });
      await tx.payslip.deleteMany({ where: { payrollRunId: payrollRun.id } });

      let totalNet = 0;

      for (const emp of employees) {
        const [absences, overtime, advances] = await Promise.all([
          tx.attendance.findMany({
            where: {
              employeeId: emp.id,
              date: { gte: periodStart, lt: periodEnd },
              status: 'ABSENT',
            },
            select: { date: true },
          }),
          tx.attendance.aggregate({
            _sum: { overtimeMins: true },
            where: { employeeId: emp.id, date: { gte: periodStart, lt: periodEnd } },
          }),
          tx.employeeAdvance.findMany({
            where: { employeeId: emp.id, status: 'ACTIVE' },
            include: { repayments: { select: { amount: true } } },
            orderBy: { grantedAt: 'asc' },
          }),
        ]);

        const base = Number(emp.baseSalary);
        const allowances = Number(emp.allowance);
        const dailyRate = base / workingDays;
        const hourlyRate = dailyRate / 8;

        // الغياب في يوم مضاعف يُحتسب بيومين
        let chargedDays = 0;
        let doubledCount = 0;
        for (const record of absences) {
          if (doubleDays.has(record.date.getUTCDay())) {
            chargedDays += 2;
            doubledCount++;
          } else {
            chargedDays += 1;
          }
        }

        const overtimePay =
          Math.round(((overtime._sum.overtimeMins ?? 0) / 60) * hourlyRate * 1.25 * 1000) / 1000;
        const absenceDeduction = Math.round(chargedDays * dailyRate * 1000) / 1000;

        const empManual = manualByEmployee.get(emp.id) ?? [];
        const manualEarnings = empManual
          .filter((i) => i.type === 'EARNING')
          .reduce((sum, i) => sum + Number(i.amount), 0);
        const manualDeductions = empManual
          .filter((i) => i.type === 'DEDUCTION')
          .reduce((sum, i) => sum + Number(i.amount), 0);

        // قسط السلفة = الأقل بين القسط الشهري والمتبقّي
        const advanceInstallments: Array<{ advanceId: string; amount: number }> = [];
        for (const advance of advances) {
          const paid = advance.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
          const remaining = Math.round((Number(advance.amount) - paid) * 1000) / 1000;
          if (remaining <= 0) continue;
          const installment = Math.min(Number(advance.monthlyDeduction), remaining);
          if (installment > 0) {
            advanceInstallments.push({ advanceId: advance.id, amount: installment });
          }
        }
        const advanceTotal =
          Math.round(advanceInstallments.reduce((s, a) => s + a.amount, 0) * 1000) / 1000;

        const deductions =
          Math.round((absenceDeduction + advanceTotal + manualDeductions) * 1000) / 1000;
        const netPay =
          Math.round((base + allowances + overtimePay + manualEarnings - deductions) * 1000) / 1000;

        totalNet += netPay;

        const payslip = await tx.payslip.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: emp.id,
            baseSalary: base,
            allowances,
            overtime: overtimePay,
            deductions,
            netPay,
            absentDays: absences.length,
          },
        });

        const items = [
          { type: 'EARNING' as const, label: 'الراتب الأساسي', amount: base, isManual: false },
          ...(allowances > 0
            ? [{ type: 'EARNING' as const, label: 'البدلات', amount: allowances, isManual: false }]
            : []),
          ...(overtimePay > 0
            ? [{ type: 'EARNING' as const, label: 'ساعات إضافية', amount: overtimePay, isManual: false }]
            : []),
          ...(absenceDeduction > 0
            ? [
                {
                  type: 'DEDUCTION' as const,
                  label:
                    doubledCount > 0
                      ? `خصم غياب — ${absences.length} يوم (${doubledCount} خميس/سبت بخصم مضاعف = ${chargedDays} يوم)`
                      : `خصم غياب (${absences.length} يوم)`,
                  amount: absenceDeduction,
                  isManual: false,
                },
              ]
            : []),
          ...advanceInstallments.map((a) => ({
            type: 'DEDUCTION' as const,
            label: 'قسط سلفة',
            amount: a.amount,
            isManual: false,
          })),
          // البنود اليدوية المحفوظة
          ...empManual.map((i) => ({
            type: i.type,
            label: i.label,
            amount: Number(i.amount),
            isManual: true,
          })),
        ];

        await tx.payslipItem.createMany({
          data: items.map((i) => ({ ...i, payslipId: payslip.id })),
        });

        // تسجيل أقساط السلف وإقفال المسدّدة بالكامل
        for (const installment of advanceInstallments) {
          await tx.advanceRepayment.create({
            data: {
              advanceId: installment.advanceId,
              payrollRunId: payrollRun.id,
              amount: installment.amount,
              note: `مسيّر ${month}/${year}`,
            },
          });

          const advance = await tx.employeeAdvance.findUnique({
            where: { id: installment.advanceId },
            include: { repayments: { select: { amount: true } } },
          });
          if (advance) {
            const paid = advance.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
            if (paid >= Number(advance.amount)) {
              await tx.employeeAdvance.update({
                where: { id: advance.id },
                data: { status: 'SETTLED' },
              });
            }
          }
        }
      }

      return tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalNet: Math.round(totalNet * 1000) / 1000 },
      });
    });

    revalidatePath('/dashboard/hr/payroll');
    revalidatePath('/dashboard/hr/advances');
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

// ═══════════════════════════════════════════════════════════
//  السلف
// ═══════════════════════════════════════════════════════════

export const saveAdvance = action({
  permission: 'hr:write',
  schema: z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1, 'الموظف مطلوب'),
    amount: moneySchema,
    monthlyDeduction: moneySchema,
    reason: optionalString,
    grantedAt: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : dateOnlyFromInput(v))),
    notes: optionalString,
  }),
  audit: { entity: 'EmployeeAdvance', action: 'SAVE' },
  handler: async ({ id, ...data }) => {
    if (data.amount <= 0) throw new Error('قيمة السلفة يجب أن تكون أكبر من صفر');
    if (data.monthlyDeduction <= 0) throw new Error('القسط الشهري يجب أن يكون أكبر من صفر');
    if (data.monthlyDeduction > data.amount) {
      throw new Error('القسط الشهري لا يمكن أن يتجاوز إجمالي السلفة');
    }

    // لا نسمح بقسط يبتلع الراتب كاملاً
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId },
      select: { baseSalary: true, allowance: true, fullName: true },
    });
    if (!employee) throw new Error('الموظف غير موجود');

    const salary = Number(employee.baseSalary) + Number(employee.allowance);
    if (data.monthlyDeduction > salary * 0.5) {
      throw new Error(
        `القسط الشهري لا يجوز أن يتجاوز نصف الراتب (${(salary / 2).toFixed(3)} د.ك)`
      );
    }

    if (id) {
      const paid = await db.advanceRepayment.aggregate({
        _sum: { amount: true },
        where: { advanceId: id },
      });
      const paidAmount = Number(paid._sum.amount ?? 0);
      if (paidAmount > 0 && data.amount < paidAmount) {
        throw new Error(`تم سداد ${paidAmount.toFixed(3)} د.ك — لا يمكن تخفيض السلفة دونها`);
      }

      await db.employeeAdvance.update({ where: { id }, data });
      revalidatePath('/dashboard/hr/advances');
      return { id, message: 'تم تحديث السلفة' };
    }

    const created = await db.employeeAdvance.create({ data });
    revalidatePath('/dashboard/hr/advances');
    revalidatePath(`/dashboard/hr/employees/${data.employeeId}`);
    return { id: created.id, message: `تم تسجيل سلفة ${employee.fullName}` };
  },
});

export const setAdvanceStatus = action({
  permission: 'hr:write',
  schema: z.object({ id: z.string(), status: z.enum(AdvanceStatus) }),
  audit: { entity: 'EmployeeAdvance', action: 'STATUS' },
  handler: async ({ id, status }) => {
    await db.employeeAdvance.update({ where: { id }, data: { status } });
    revalidatePath('/dashboard/hr/advances');
    const labels = { ACTIVE: 'إعادة تفعيل', SETTLED: 'إقفال', CANCELLED: 'إلغاء' };
    return { id, message: `تم ${labels[status]} السلفة` };
  },
});

/** سداد يدوي خارج مسيّر الرواتب (نقداً مثلاً) */
export const repayAdvance = action({
  permission: 'hr:write',
  schema: z.object({
    advanceId: z.string(),
    amount: moneySchema,
    note: optionalString,
  }),
  audit: { entity: 'AdvanceRepayment', action: 'MANUAL' },
  handler: async ({ advanceId, amount, note }) => {
    if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

    const advance = await db.employeeAdvance.findUnique({
      where: { id: advanceId },
      include: { repayments: { select: { amount: true } } },
    });
    if (!advance) throw new Error('السلفة غير موجودة');

    const paid = advance.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
    const remaining = Math.round((Number(advance.amount) - paid) * 1000) / 1000;

    if (amount > remaining) {
      throw new Error(`المتبقي ${remaining.toFixed(3)} د.ك فقط`);
    }

    await db.$transaction(async (tx) => {
      await tx.advanceRepayment.create({
        data: { advanceId, amount, note: note ?? 'سداد يدوي' },
      });
      if (amount >= remaining) {
        await tx.employeeAdvance.update({ where: { id: advanceId }, data: { status: 'SETTLED' } });
      }
    });

    revalidatePath('/dashboard/hr/advances');
    return { id: advanceId, message: 'تم تسجيل السداد' };
  },
});

// ═══════════════════════════════════════════════════════════
//  بنود القسيمة اليدوية (مكافآت وجزاءات)
// ═══════════════════════════════════════════════════════════

/** يعيد حساب إجمالي القسيمة والمسيّر بعد أي تعديل يدوي */
async function recalcPayslip(payslipId: string) {
  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: { items: true },
  });
  if (!payslip) return;

  const earnings = payslip.items
    .filter((i) => i.type === 'EARNING')
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const deductions = payslip.items
    .filter((i) => i.type === 'DEDUCTION')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  await db.payslip.update({
    where: { id: payslipId },
    data: {
      deductions: Math.round(deductions * 1000) / 1000,
      netPay: Math.round((earnings - deductions) * 1000) / 1000,
    },
  });

  const all = await db.payslip.findMany({
    where: { payrollRunId: payslip.payrollRunId },
    select: { netPay: true },
  });

  await db.payrollRun.update({
    where: { id: payslip.payrollRunId },
    data: {
      totalNet: Math.round(all.reduce((sum, p) => sum + Number(p.netPay), 0) * 1000) / 1000,
    },
  });
}

/** يمنع تعديل قسيمة في مسيّر معتمد أو مدفوع */
async function assertPayrollEditable(payslipId: string) {
  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: { payrollRun: { select: { id: true, status: true } } },
  });
  if (!payslip) throw new Error('القسيمة غير موجودة');
  if (payslip.payrollRun.status !== 'DRAFT') {
    throw new Error('المسيّر معتمد — أعِده إلى مسودة قبل التعديل');
  }
  return payslip;
}

export const addPayslipItem = action({
  permission: 'hr:write',
  schema: z.object({
    payslipId: z.string(),
    type: z.enum(PayslipItemType),
    label: z.string().trim().min(2, 'وصف البند مطلوب'),
    amount: moneySchema,
  }),
  audit: { entity: 'PayslipItem', action: 'ADD' },
  handler: async ({ payslipId, type, label, amount }) => {
    if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    const payslip = await assertPayrollEditable(payslipId);

    await db.payslipItem.create({
      data: { payslipId, type, label, amount, isManual: true },
    });
    await recalcPayslip(payslipId);

    revalidatePath(`/dashboard/hr/payroll/${payslip.payrollRun.id}`);
    return { id: payslipId, message: 'تمت إضافة البند' };
  },
});

export const deletePayslipItem = action({
  permission: 'hr:write',
  schema: z.object({ id: z.string() }),
  audit: { entity: 'PayslipItem', action: 'DELETE' },
  handler: async ({ id }) => {
    const item = await db.payslipItem.findUnique({ where: { id } });
    if (!item) throw new Error('البند غير موجود');
    if (!item.isManual) throw new Error('البنود المحسوبة آلياً لا تُحذف — عدّل مصدرها');

    const payslip = await assertPayrollEditable(item.payslipId);
    await db.payslipItem.delete({ where: { id } });
    await recalcPayslip(item.payslipId);

    revalidatePath(`/dashboard/hr/payroll/${payslip.payrollRun.id}`);
    return { id, message: 'تم حذف البند' };
  },
});
