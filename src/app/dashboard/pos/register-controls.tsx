'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, LockKeyhole, Unlock } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { formatKWD } from '@/lib/utils';
import { closeRegister, openRegister } from './actions';

export function OpenRegisterButton() {
  const [open, setOpen] = useState(false);
  const [float, setFloat] = useState('0.000');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await openRegister({ openingFloat: float });
      if (res.ok) {
        toast.success(res.message ?? 'تم الفتح');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Unlock />
        فتح وردية
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="فتح وردية الصندوق"
          description="أدخل الرصيد النقدي الموجود في الدرج عند بداية الوردية"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                فتح الوردية
              </Button>
            </>
          }
        >
          <Field label="الرصيد الافتتاحي (د.ك)">
            <Input
              type="number"
              step="0.001"
              min={0}
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              dir="ltr"
              className="tnum text-start"
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

export function CloseRegisterButton({
  id,
  openingFloat,
  cashSales,
}: {
  id: string;
  openingFloat: number;
  cashSales: number;
}) {
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const expected = Math.round((openingFloat + cashSales) * 1000) / 1000;
  const counted = Number(cash) || 0;
  const variance = cash === '' ? null : Math.round((counted - expected) * 1000) / 1000;

  function submit() {
    startTransition(async () => {
      const res = await closeRegister({ id, closingCash: cash, notes });
      if (res.ok) {
        toast.success(res.message ?? 'تم الإغلاق');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <LockKeyhole />
        إغلاق الوردية
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="إغلاق وردية الصندوق"
          description="عُدّ النقدية في الدرج وأدخل المبلغ الفعلي"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending || cash === ''}>
                {pending && <Loader2 className="animate-spin" />}
                إغلاق الوردية
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-[13px]">
              <Row label="الرصيد الافتتاحي" value={formatKWD(openingFloat)} />
              <Row label="مبيعات نقدية" value={formatKWD(cashSales)} />
              <div className="border-t border-[var(--line)] pt-2">
                <Row label="المتوقع في الدرج" value={formatKWD(expected)} bold />
              </div>
            </div>

            <Field label="النقدية المعدودة فعلياً (د.ك)">
              <Input
                type="number"
                step="0.001"
                min={0}
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
                autoFocus
              />
            </Field>

            {variance !== null && variance !== 0 && (
              <div
                className={
                  variance > 0
                    ? 'rounded-[var(--radius-sm)] border border-info/30 bg-info/10 px-3.5 py-2.5 text-[13px] text-info'
                    : 'rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger'
                }
              >
                {variance > 0 ? 'زيادة في الصندوق: ' : 'عجز في الصندوق: '}
                <span className="tnum font-bold">{formatKWD(Math.abs(variance))}</span>
              </div>
            )}

            {variance === 0 && (
              <div className="rounded-[var(--radius-sm)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-[13px] text-ok">
                الصندوق مطابق تماماً ✓
              </div>
            )}

            <Field label="ملاحظات">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-16"
                placeholder="تفسير الفرق إن وُجد…"
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-bold text-[var(--text-0)]' : 'text-[var(--text-1)]'}>
        {label}
      </span>
      <span className={bold ? 'tnum font-bold text-[var(--text-0)]' : 'tnum text-[var(--text-1)]'}>
        {value}
      </span>
    </div>
  );
}
