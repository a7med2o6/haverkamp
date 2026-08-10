import { z } from 'zod';
import { assertPermission } from '@/lib/guard';
import { db } from '@/lib/db';
import type { Permission } from '@/lib/rbac';

export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** رسائل الأخطاء الشائعة بالعربية */
const ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'انتهت الجلسة — يُرجى تسجيل الدخول مرة أخرى',
  FORBIDDEN: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
};

/** يحوّل الأخطاء المعروفة إلى رسالة عربية مفهومة */
export function toErrorState(e: unknown): ActionState {
  if (e instanceof Error) {
    if (ERRORS[e.message]) return { ok: false, error: ERRORS[e.message] };
    // قيد التفرّد في Postgres
    if ('code' in e && e.code === 'P2002') {
      return { ok: false, error: 'هذه القيمة مسجّلة مسبقاً — يُرجى استخدام قيمة مختلفة' };
    }
    if ('code' in e && e.code === 'P2003') {
      return { ok: false, error: 'لا يمكن الحذف لارتباط السجل بسجلات أخرى' };
    }
    if ('code' in e && e.code === 'P2025') {
      return { ok: false, error: 'السجل غير موجود أو تم حذفه' };
    }
  }
  console.error('[action]', e);
  return { ok: false, error: 'حدث خطأ غير متوقع — حاول مرة أخرى' };
}

/**
 * يغلّف server action بالتحقق من الصلاحية وتحليل المدخلات وتسجيل التدقيق.
 */
export function action<S extends z.ZodType>(config: {
  permission: Permission;
  schema: S;
  /** لتسجيل العملية في سجل التدقيق */
  audit?: { entity: string; action: string };
  handler: (
    input: z.infer<S>,
    ctx: { userId: string }
  ) => Promise<{ id?: string; message?: string } | void>;
}) {
  return async (input: unknown): Promise<ActionState> => {
    try {
      const session = await assertPermission(config.permission);

      const parsed = config.schema.safeParse(input);
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        const fieldErrors = flat.fieldErrors as Record<string, string[]>;
        // أول رسالة خطأ — من الحقول أولاً ثم من التحققات على مستوى النموذج
        const first =
          Object.values(fieldErrors).flat()[0] ?? flat.formErrors[0];
        return {
          ok: false,
          error: first ?? 'البيانات المُدخلة غير صالحة',
          fieldErrors,
        };
      }

      const result = await config.handler(parsed.data, { userId: session.user.id });

      if (config.audit) {
        await db.auditLog
          .create({
            data: {
              userId: session.user.id,
              action: config.audit.action,
              entity: config.audit.entity,
              entityId: result?.id ?? null,
            },
          })
          .catch(() => {}); // التدقيق لا يُفشل العملية
      }

      return { ok: true, id: result?.id, message: result?.message };
    } catch (e) {
      return toErrorState(e);
    }
  };
}

/** حقول اختيارية تتحوّل من "" إلى null */
export const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const optionalNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .nullable()
  .optional();

export const optionalDate = z
  .union([z.string(), z.date()])
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .nullable()
  .optional();

/** رقم هاتف كويتي أو دولي */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'رقم الهاتف قصير جداً')
  .max(20, 'رقم الهاتف طويل جداً')
  .regex(/^[+\d\s-]+$/, 'رقم الهاتف يحتوي على رموز غير صالحة');

/** مبلغ مالي — يقبل النص والرقم */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((n) => Number.isFinite(n) && n >= 0, 'المبلغ غير صالح');
