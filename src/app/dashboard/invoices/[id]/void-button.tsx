'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, Loader2, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { PAYMENT_METHOD } from '@/lib/labels';
import { formatKWD } from '@/lib/utils';
import { cancelOrder, refundOrder } from '@/app/dashboard/pos/actions';

/**
 * إلغاء الفاتورة أو ردّها — زرّ واحد يعرف أيّهما.
 *
 * ما لم يُحصَّل منه شيء يُلغى، وما حُصِّل منه يُردّ: الفرق ليس اسماً،
 * الردّ يُخرج مالاً من الدرج. فيُعرض قبل التأكيد ما سيُردّ بكل طريقة، لا
 * رقماً واحداً يُفاجأ به الكاشير عند إغلاق ورديته.
 */
export function VoidInvoiceButton({
  orderId,
  number,
  refunds,
  isJob,
}: {
  orderId: string;
  number: string;
  /** صافي المحصَّل بكل طريقة — فارغ يعني إلغاءً لا ردّاً */
  refunds: { method: keyof typeof PAYMENT_METHOD; amount: number }[];
  /** فاتورة أمر شغل — تنفكّ عنه ليُصدر له غيرها */
  isJob: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refund = refunds.length > 0;
  const total = refunds.reduce((sum, r) => sum + r.amount, 0);
  const ready = reason.trim().length >= 3;

  function submit() {
    startTransition(async () => {
      const res = await (refund ? refundOrder : cancelOrder)({ orderId, reason });
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
        className="text-danger"
        onClick={() => {
          setReason('');
          setOpen(true);
        }}
      >
        {refund ? <Undo2 /> : <Ban />}
        {refund ? 'مرتجع' : 'إلغاء الفاتورة'}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={refund ? `ردّ الفاتورة ${number}` : `إلغاء الفاتورة ${number}`}
          description="لا تُحذف الفاتورة — تبقى برقمها وسببها، وحالتها تقول ما جرى لها"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                تراجع
              </Button>
              <Button variant="danger" onClick={submit} disabled={pending || !ready}>
                {pending && <Loader2 className="animate-spin" />}
                {refund ? `ردّ ${formatKWD(total)}` : 'إلغاء الفاتورة'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {refund && (
              <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px]">
                <p className="mb-1.5 font-semibold text-danger">يُردّ للعميل</p>
                <ul className="space-y-1">
                  {refunds.map((r) => (
                    <li key={r.method} className="flex items-center justify-between">
                      <span className="text-[var(--text-1)]">{PAYMENT_METHOD[r.method].label}</span>
                      <span className="tnum font-semibold text-[var(--text-0)]">
                        {formatKWD(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--text-2)]">
                  النقد يُخصم من متوقَّع درج ورديتك المفتوحة
                </p>
              </div>
            )}

            <Field label={refund ? 'سبب الردّ' : 'سبب الإلغاء'}>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={refund ? 'العميل ألغى الشغل، خطأ في الفاتورة…' : 'خطأ في البنود، فاتورة مكرّرة…'}
                autoFocus
              />
            </Field>

            <ul className="space-y-1 text-[12px] text-[var(--text-2)]">
              <li>· ما خرج من المخزون بهذه الفاتورة يعود إليه</li>
              {isJob && <li>· تنفكّ عن أمر الشغل، فيُصدر له فاتورة جديدة من صفحته</li>}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}
