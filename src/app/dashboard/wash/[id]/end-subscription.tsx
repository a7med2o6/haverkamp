'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, PowerOff, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { dateOnlyFromInput, formatDateOnly, formatKWD, formatWeekday } from '@/lib/utils';
import { washEndPreview, endWashSubscription, resumeWashSubscription } from '../actions';
import type { WashEndPlan } from '../end-service';

export function EndSubscription({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<WashEndPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  /*
    المعاينة تُطلب لحظة الفتح لا في effect يراقب open: الحالة تُصفَّر وتُملأ
    من الحدث نفسه، فلا رندر وسيط بمعاينةٍ قديمة من فتحةٍ سابقة.
  */
  function openModal() {
    setOpen(true);
    setPlan(null);
    setError(null);
    setReason('');
    setLoading(true);
    washEndPreview({ id }).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setPlan(res.data as unknown as WashEndPlan);
      else setError(res.ok ? 'تعذّر تحميل معاينة إنهاء الاشتراك.' : res.error);
    });
  }

  const trimmedReason = reason.trim();
  const isValidReason = trimmedReason.length >= 3 && trimmedReason.length <= 300;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidReason || !plan || pending) return;

    startTransition(async () => {
      const res = await endWashSubscription({ id, reason: trimmedReason });
      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر إنهاء الاشتراك');
        return;
      }
      toast.success(res.message ?? 'تم إنهاء الاشتراك بنجاح');
      setOpen(false);
      router.refresh();
    });
  }

  const endFormatted = plan?.endDate
    ? (() => {
        const d = dateOnlyFromInput(plan.endDate);
        return `${formatWeekday(d)} ${formatDateOnly(d)}`;
      })()
    : '';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openModal}
        className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
      >
        <PowerOff className="size-4" />
        إنهاء الاشتراك
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="إنهاء اشتراك الغسيل"
        description="إنهاء العقد وفق قاعدة الخدمة لما دُفع وإلغاء ما لم يُدفع"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              إلغاء
            </Button>
            {!error && (
              <Button
                type="submit"
                form="end-subscription-form"
                variant="danger"
                disabled={pending || loading || !plan || !isValidReason}
              >
                {pending ? <Loader2 className="animate-spin size-4" /> : <PowerOff className="size-4" />}
                تأكيد الإنهاء
              </Button>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-2)]">
            <Loader2 className="animate-spin size-6 text-accent mb-2" />
            <p className="text-[13px]">جاري حساب خطة إنهاء الاشتراك…</p>
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-md)] border border-danger/30 bg-[var(--mark-danger)]/10 p-4 text-[13px] text-danger space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-4 shrink-0" />
              <span>لا يمكن إنهاء الاشتراك</span>
            </div>
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : plan ? (
          <form id="end-subscription-form" onSubmit={submit} className="space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[var(--text-0)]">آخر يوم غسيل:</span>
                <span className="tnum font-bold text-accent">{endFormatted}</span>
              </div>

              {plan.keptPeriods.length > 0 && (
                <div className="text-[12px] space-y-1 border-t border-[var(--line)] pt-2">
                  <p className="font-medium text-ok">تستمر لأنها مدفوعة ({plan.keptPeriods.length} فترة):</p>
                  <ul className="space-y-1 ps-3 text-[var(--text-1)] list-disc">
                    {plan.keptPeriods.map((p) => (
                      <li key={p.id} className="tnum">
                        من {formatDateOnly(dateOnlyFromInput(p.from))} إلى {formatDateOnly(dateOnlyFromInput(p.to))}
                        {p.invoice && <span className="ms-1" dir="ltr">({p.invoice})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.cancelledInvoices.length > 0 && (
                <div className="text-[12px] space-y-1 border-t border-[var(--line)] pt-2">
                  <p className="font-medium text-danger">ستُلغى — لم يُسدَّد منها شيء ({plan.cancelledInvoices.length} فاتورة):</p>
                  <ul className="space-y-1 ps-3 text-[var(--text-1)] list-disc">
                    {plan.cancelledInvoices.map((inv) => (
                      <li key={inv.orderId} className="tnum">
                        فاتورة <span dir="ltr">{inv.number}</span> ({formatKWD(inv.total)}) للفترة من {formatDateOnly(dateOnlyFromInput(inv.from))} إلى {formatDateOnly(dateOnlyFromInput(inv.to))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.removedVisits > 0 && (
                <p className="text-[12px] text-warn border-t border-[var(--line)] pt-2 font-medium">
                  ستُحذف {plan.removedVisits} غسلة لم تُستحق.
                </p>
              )}

              <p className="text-[12px] text-[var(--text-2)] border-t border-[var(--line)] pt-2 font-medium">
                لا تتحرّك أي مبالغ.
              </p>
            </div>

            <Field
              label="سبب الإنهاء"
              hint="اكتب سبباً واضحاً بين 3 و300 حرف"
              error={
                trimmedReason.length > 0 && trimmedReason.length < 3
                  ? 'السبب قصير جداً (3 حروف على الأقل)'
                  : trimmedReason.length > 300
                    ? 'السبب طويل جداً (300 حرف كحد أقصى)'
                    : undefined
              }
            >
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: بناءً على طلب العميل لسفره المفاجئ…"
                maxLength={300}
                required
              />
            </Field>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

export function ResumeSubscription({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleResume() {
    if (!window.confirm('هل أنت تأكد من استئناف اشتراك الغسيل؟')) return;

    startTransition(async () => {
      const res = await resumeWashSubscription({ id });
      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر استئناف الاشتراك');
        return;
      }
      toast.success(res.message ?? 'تم استئناف الاشتراك بنجاح');
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleResume}
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin size-4" /> : <RotateCcw className="size-4" />}
      استئناف الاشتراك
    </Button>
  );
}
