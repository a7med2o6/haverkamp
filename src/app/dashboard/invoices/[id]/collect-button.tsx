'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HandCoins, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { PAYMENT_METHOD, toOptions } from '@/lib/labels';
import { formatKWD } from '@/lib/utils';
import { collectPayment } from '@/app/dashboard/pos/actions';

/** تحصيل المتبقي على فاتورة آجلة أو مدفوعة جزئياً */
export function CollectPaymentButton({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(remaining.toFixed(3));
  const [reference, setReference] = useState('');

  const entered = Number(amount) || 0;
  const left = Math.round((remaining - entered) * 1000) / 1000;

  function submit() {
    startTransition(async () => {
      const res = await collectPayment({ orderId, method, amount, reference });
      if (res.ok) {
        toast.success(res.message ?? 'تم التحصيل');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="success" size="sm" onClick={() => setOpen(true)}>
        <HandCoins />
        تحصيل المتبقي
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تحصيل دفعة"
          description={`المتبقي على الفاتورة ${formatKWD(remaining)}`}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending || entered <= 0}>
                {pending && <Loader2 className="animate-spin" />}
                تسجيل التحصيل
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="طريقة الدفع">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {toOptions(PAYMENT_METHOD)
                  .filter((o) => o.value !== 'CREDIT')
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </Select>
            </Field>

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

            {method !== 'CASH' && (
              <Field label="رقم العملية / المرجع">
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  dir="ltr"
                  className="text-start"
                />
              </Field>
            )}

            {entered > 0 && left > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
                سيبقى <span className="tnum font-bold">{formatKWD(left)}</span> مستحقاً بعد هذا
                التحصيل
              </div>
            )}

            {entered > 0 && left <= 0 && (
              <div className="rounded-[var(--radius-sm)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-[13px] font-semibold text-ok">
                ✓ ستُسدَّد الفاتورة بالكامل
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
