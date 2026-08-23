'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, HandCoins, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { formatKWD } from '@/lib/utils';
import { deleteRepayment, repayAdvance, saveAdvance, setAdvanceStatus } from '../actions';

export interface AdvanceValues {
  id?: string;
  employeeId: string;
  amount: number | string;
  monthlyDeduction: number | string;
  reason?: string | null;
  grantedAt: string;
  notes?: string | null;
}

export function AdvanceFormButton({
  employees,
  advance,
}: {
  employees: Array<{ id: string; fullName: string; code: string; salary: number }>;
  advance?: AdvanceValues;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!advance?.id;

  const [values, setValues] = useState<AdvanceValues>(
    advance ?? {
      employeeId: '',
      amount: '',
      monthlyDeduction: '',
      reason: '',
      grantedAt: new Date().toISOString().slice(0, 10),
      notes: '',
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const employee = employees.find((e) => e.id === values.employeeId);
  const amount = Number(values.amount) || 0;
  const installment = Number(values.monthlyDeduction) || 0;
  const months = installment > 0 ? Math.ceil(amount / installment) : 0;
  const maxInstallment = employee ? employee.salary / 2 : 0;

  function set<K extends keyof AdvanceValues>(k: K, v: AdvanceValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveAdvance(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={isEdit ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل السلفة' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />سلفة جديدة</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل السلفة' : 'سلفة جديدة'}
          description="يُخصم القسط تلقائياً من مسيّر الرواتب كل شهر حتى السداد الكامل"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="advance-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="advance-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الموظف" className="sm:col-span-2" error={errors.employeeId?.[0]}>
              <Select
                value={values.employeeId}
                onChange={(e) => set('employeeId', e.target.value)}
                required
                disabled={isEdit}
              >
                <option value="">— اختر الموظف —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} — {e.fullName} ({formatKWD(e.salary)})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="قيمة السلفة (د.ك)" error={errors.amount?.[0]}>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.amount}
                onChange={(e) => set('amount', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
                required
              />
            </Field>

            <Field
              label="القسط الشهري (د.ك)"
              error={errors.monthlyDeduction?.[0]}
              hint={
                employee
                  ? `الحد الأقصى ${formatKWD(maxInstallment)} — نصف الراتب`
                  : 'اختر الموظف أولاً'
              }
            >
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.monthlyDeduction}
                onChange={(e) => set('monthlyDeduction', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
                required
              />
            </Field>

            <Field label="تاريخ الصرف">
              <Input
                type="date"
                value={values.grantedAt}
                onChange={(e) => set('grantedAt', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="السبب">
              <Input
                value={values.reason ?? ''}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="ظرف طارئ، علاج…"
              />
            </Field>

            {months > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-accent/30 bg-accent/[0.07] px-3.5 py-2.5 text-[13px] text-accent-soft sm:col-span-2">
                تُسدَّد على <span className="tnum font-bold">{months}</span>{' '}
                {months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'أشهر'}
                {installment > maxInstallment && employee && (
                  <span className="mt-1 block text-warn">
                    ⚠ القسط يتجاوز نصف الراتب — لن يُقبل الحفظ
                  </span>
                )}
              </div>
            )}

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
                className="min-h-16"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

/** تاريخ اليوم المحلي بصيغة <input type="date"> */
function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function RepayButton({
  advanceId,
  remaining,
  monthlyDeduction,
}: {
  advanceId: string;
  remaining: number;
  monthlyDeduction: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState(today());

  /** الافتراضي قسط واحد لا كامل المتبقي — إقفال السلفة يجب أن يكون اختياراً صريحاً */
  const installment = Math.min(monthlyDeduction, remaining);
  const [amount, setAmount] = useState(installment.toFixed(3));

  const entered = Number(amount) || 0;
  const left = Math.round((remaining - entered) * 1000) / 1000;
  const willSettle = entered > 0 && left <= 0;

  function submit() {
    startTransition(async () => {
      const res = await repayAdvance({ advanceId, amount, paidAt, note });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="success"
        size="sm"
        onClick={() => {
          // نعيد الضبط عند كل فتح — المتبقي يتغيّر بعد كل سداد
          setAmount(installment.toFixed(3));
          setPaidAt(today());
          setNote('');
          setOpen(true);
        }}
      >
        <HandCoins />
        سداد
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="سداد يدوي"
          description={`المتبقي ${formatKWD(remaining)} — استخدم هذا للسداد النقدي خارج المسيّر`}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تسجيل السداد
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="المبلغ (د.ك)">
              <Input
                type="number"
                step="0.001"
                min={0}
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                dir="ltr"
                className="tnum text-start"
                autoFocus
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAmount(installment.toFixed(3))}
                className="tnum rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]"
              >
                قسط شهري — {formatKWD(installment)}
              </button>
              <button
                type="button"
                onClick={() => setAmount(remaining.toFixed(3))}
                className="tnum rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]"
              >
                كامل المتبقي — {formatKWD(remaining)}
              </button>
            </div>

            <Field label="تاريخ السداد" hint="اليوم الذي استُلم فيه المبلغ فعلاً">
              <Input
                type="date"
                value={paidAt}
                max={today()}
                onChange={(e) => setPaidAt(e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="ملاحظة">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="سداد نقدي…"
              />
            </Field>

            {entered > 0 &&
              (willSettle ? (
                <div className="rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] font-semibold text-warn">
                  ⚠ هذا المبلغ يُقفل السلفة بالكامل ويحوّل حالتها إلى «مسدّدة»
                </div>
              ) : (
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px]">
                  <span className="text-[var(--text-2)]">سيبقى </span>
                  <span className="tnum font-bold text-[var(--text-0)]">{formatKWD(left)}</span>
                  <span className="text-[var(--text-2)]"> بعد هذا السداد</span>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}

export function CancelAdvanceButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await setAdvanceStatus({ id, status: 'CANCELLED' });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirming(true)}
        aria-label="إلغاء السلفة"
        title="إلغاء السلفة"
      >
        <Ban className="text-danger" />
      </Button>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="إلغاء السلفة"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                تراجع
              </Button>
              <Button variant="danger" onClick={run} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الإلغاء
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-1)]">
            سيتوقف خصم القسط من المسيّرات القادمة. الأقساط المسدّدة تبقى مسجّلة.
          </p>
        </Modal>
      )}
    </>
  );
}


/** حذف قسط سُجّل بالخطأ — يدوي فقط */
export function DeleteRepaymentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await deleteRepayment({ id });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحذف');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="حذف القسط"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="text-danger" />
      </Button>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف قسط"
          description={label}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                تراجع
              </Button>
              <Button variant="danger" onClick={run} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حذف
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-[var(--text-1)]">
            سيُحذف القسط نهائياً ويُعاد حساب المتبقي وحالة السلفة. استعمله لتصحيح إدخال خاطئ فقط.
          </p>
        </Modal>
      )}
    </>
  );
}
