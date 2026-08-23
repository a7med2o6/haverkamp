'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Percent } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { formatKWD } from '@/lib/utils';
import { setOrderDiscount } from '@/app/dashboard/pos/actions';

/** خصم على الفاتورة — بمبلغ أو بنسبة، مع سبب يظهر في الفاتورة المطبوعة */
export function DiscountButton({
  orderId,
  subtotal,
  taxAmount,
  paidAmount,
  discountAmount,
  discountNote,
}: {
  orderId: string;
  subtotal: number;
  taxAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountNote: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(discountAmount ? String(discountAmount) : '');
  const [note, setNote] = useState(discountNote);

  const entered = Number(amount) || 0;
  const total = Math.round((subtotal - entered + taxAmount) * 1000) / 1000;
  const tooBig = entered > subtotal;
  const belowPaid = total < paidAmount;

  /** النسبة زر مساعد فقط — المحفوظ دائماً مبلغ بالدينار */
  function applyPercent(percent: number) {
    setAmount((Math.round(subtotal * percent * 10) / 1000).toFixed(3));
  }

  function submit() {
    startTransition(async () => {
      const res = await setOrderDiscount({
        orderId,
        discountAmount: amount || 0,
        discountNote: note,
      });
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
        variant="secondary"
        size="sm"
        onClick={() => {
          setAmount(discountAmount ? String(discountAmount) : '');
          setNote(discountNote);
          setOpen(true);
        }}
      >
        <Percent />
        {discountAmount > 0 ? 'تعديل الخصم' : 'خصم'}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="خصم على الفاتورة"
          description={`قيمة الفاتورة قبل الخصم ${formatKWD(subtotal)}`}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending || tooBig || belowPaid}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="مبلغ الخصم (د.ك)">
              <Input
                type="number"
                step="0.001"
                min={0}
                max={subtotal}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                dir="ltr"
                className="tnum text-start"
                autoFocus
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 20].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPercent(p)}
                  className="tnum rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]"
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount('')}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]"
              >
                بدون خصم
              </button>
            </div>

            <Field label="سبب الخصم" hint="يظهر في الفاتورة المطبوعة بجانب الخصم">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="عميل دائم، عرض ترويجي…"
              />
            </Field>

            {tooBig ? (
              <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                الخصم أكبر من قيمة الفاتورة
              </div>
            ) : belowPaid ? (
              <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                الإجمالي بعد الخصم أقل من المحصّل{' '}
                <span className="tnum font-bold">{formatKWD(paidAmount)}</span>
              </div>
            ) : (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px]">
                <span className="text-[var(--text-2)]">الإجمالي بعد الخصم </span>
                <span className="tnum font-bold text-[var(--text-0)]">{formatKWD(total)}</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
