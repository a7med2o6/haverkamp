'use client';

import { useState, useTransition } from 'react';
import { CalendarCheck, CalendarClock, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SlotDay } from '@/lib/slots';
import { confirmBooking, rescheduleByCustomer } from './actions';

/**
 * إجراءا العميل: تأكيد الموعد أو تغييره.
 *
 * التأكيد هو الفعل المتوقّع فيأخذ الزرّ الأساسي، والتغيير خلفه بضغطة —
 * لكنه حاضر لا مخفيّ: من لا يجد له مخرجاً لا يردّ أصلاً، فيمرّ الموعد
 * بلا خبر. المواعيد تُبنى على الخادم من الدوام والطاقة الاستيعابية،
 * وما هنا عرضها فقط.
 */
export function ConfirmForm({
  token,
  confirmed,
  days,
}: {
  token: string;
  confirmed: boolean;
  /** الأيام المتاحة بخاناتها — فارغة إن لم يبقَ موعد في المدى */
  days: SlotDay[];
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<'confirmed' | 'moved' | null>(
    confirmed ? 'confirmed' : null
  );
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [dayKey, setDayKey] = useState(days[0]?.key ?? '');
  const [slot, setSlot] = useState<string | null>(null);

  const day = days.find((d) => d.key === dayKey) ?? days[0];

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, mark: 'confirmed' | 'moved') {
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        setDone(mark);
        setPicking(false);
      } else {
        setError(res.error ?? 'تعذّر إتمام الطلب');
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-ok/40 bg-ok/10 px-4 py-3 text-center text-[14px] font-semibold text-ok">
        <CheckCircle2 className="size-5 shrink-0" />
        {done === 'moved'
          ? 'تم تغيير موعدك — نراك في الموعد الجديد'
          : 'تم تأكيد موعدك — نراك قريباً'}
      </div>
    );
  }

  if (picking) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-[var(--text-0)]">
            اختر الموعد المناسب
          </p>
          <button
            onClick={() => {
              setPicking(false);
              setSlot(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--text-2)] transition-colors hover:text-[var(--text-0)]"
          >
            <X className="size-3.5" />
            رجوع
          </button>
        </div>

        {days.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-4 text-center text-[13px] text-[var(--text-1)]">
            لا توجد مواعيد متاحة حالياً — تواصل معنا على الواتساب.
          </p>
        ) : (
          <>
            {/* الأيام — شريط أفقي يمرّر، فالمدى قد يبلغ أسبوعين */}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
              {days.map((d) => (
                <button
                  key={d.key}
                  onClick={() => {
                    setDayKey(d.key);
                    setSlot(null);
                  }}
                  className={cn(
                    'shrink-0 rounded-[var(--radius-sm)] border px-3 py-2 text-center transition-colors',
                    d.key === day?.key
                      ? 'border-accent bg-accent/15'
                      : 'border-[var(--line)] hover:border-[var(--line-strong)]'
                  )}
                >
                  <span className="block text-[12px] font-semibold text-[var(--text-0)]">
                    {d.weekday}
                  </span>
                  <span className="tnum block text-[11px] text-[var(--text-2)]">
                    {d.label}
                  </span>
                </button>
              ))}
            </div>

            {/* خانات اليوم المختار */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {day?.slots.map((s) => (
                <button
                  key={s.iso}
                  disabled={s.full}
                  onClick={() => setSlot(s.iso)}
                  className={cn(
                    'tnum rounded-[var(--radius-sm)] border py-2 text-[12px] font-semibold transition-colors',
                    s.full
                      ? 'cursor-not-allowed border-[var(--line)] text-[var(--text-2)] line-through opacity-50'
                      : s.iso === slot
                        ? 'border-accent bg-accent/20 text-[var(--text-0)]'
                        : 'border-[var(--line)] text-[var(--text-1)] hover:border-accent hover:text-[var(--text-0)]'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={!slot || pending}
              onClick={() =>
                slot && run(() => rescheduleByCustomer(token, slot), 'moved')
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
              تثبيت الموعد الجديد
            </Button>
          </>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    );
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => run(() => confirmBooking(token), 'confirmed')}
      >
        {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
        تأكيد الموعد
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="mt-2 w-full"
        disabled={pending}
        onClick={() => setPicking(true)}
      >
        <CalendarClock />
        تغيير الموعد
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}
    </>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-[var(--radius-sm)] border border-danger/40 bg-danger/10 px-3 py-2 text-center text-[13px] text-danger">
      {children}
    </p>
  );
}
