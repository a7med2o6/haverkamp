'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDateOnly, formatKWD, formatWeekday } from '@/lib/utils';
import { declineFromCard, renewFromCard } from './actions';

export type RenewalInfo = {
  open: boolean;
  decision: 'RENEW' | 'DECLINE' | null;
  endsOn: Date | string;
  nextPrice: number;
  nextFrom: Date | string | null;
};

/**
 * صندوق التجديد بالموافقة في كارت متابعة الغسيل العام للعميل (/w/[token]).
 *
 * يُعرض أعلى الصفحة عند اقتراب موعد انتهاء الاشتراك (7 أيام) لمنح العميل
 * الخيار بين التجديد لشهر جديد أو عدم التجديد، أو عرض الحالة المسجّلة سلفاً.
 */
export function RenewalBox({
  token,
  renewal,
}: {
  token: string;
  renewal: RenewalInfo | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  if (!renewal) return null;

  const endsOnDate = typeof renewal.endsOn === 'string' ? new Date(renewal.endsOn) : renewal.endsOn;
  const nextFromDate =
    renewal.nextFrom
      ? typeof renewal.nextFrom === 'string'
        ? new Date(renewal.nextFrom)
        : renewal.nextFrom
      : null;

  /*
    إن حُسم القرار سلفاً ولم يعد التجديد مفتوحاً، نعرض رسالة تأكيدية هادئة
    تبيّن للعميل موعد بدء الشهر الجديد أو تاريخ آخر غسلة.
  */
  if (!renewal.open) {
    if (renewal.decision === 'RENEW') {
      return (
        <div className="rounded-[var(--radius-lg)] border border-ok/30 bg-ok/10 p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-ok">
            <CheckCircle2 className="size-5 shrink-0" />
            <h3 className="font-bold text-[15px]">تم تجديد اشتراكك</h3>
          </div>
          <p className="text-[13px] leading-6 text-[var(--text-0)]">
            يبدأ الشهر الجديد يوم{' '}
            <span className="tnum font-semibold">{formatDateOnly(nextFromDate)}</span>، ويبدأ الغسيل بعد
            سداد فاتورته.
          </p>
        </div>
      );
    }

    if (renewal.decision === 'DECLINE') {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-[var(--text-1)]">
            <XCircle className="size-5 shrink-0" />
            <h3 className="font-bold text-[15px]">سجّلنا رغبتك بعدم التجديد</h3>
          </div>
          <p className="text-[13px] leading-6 text-[var(--text-1)]">
            آخر غسلة يوم <span className="tnum font-semibold">{formatDateOnly(endsOnDate)}</span>. شكراً لك.
          </p>
        </div>
      );
    }

    return null;
  }

  function handleRenew() {
    setError(null);
    startTransition(async () => {
      const res = await renewFromCard(token);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const res = await declineFromCard(token);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-accent/40 bg-[var(--surface-1)] p-5 space-y-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-6 shrink-0 text-accent" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[var(--text-0)]">
            ينتهي اشتراكك يوم {formatWeekday(endsOnDate)} {formatDateOnly(endsOnDate)}
          </h3>
          <p className="text-[13px] text-[var(--text-1)]">
            التجديد لشهر جديد:{' '}
            <span className="tnum font-bold text-[var(--text-0)]">
              {formatKWD(renewal.nextPrice)}
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}

      {confirmDecline ? (
        <div className="rounded-[var(--radius-md)] border border-warn/30 bg-warn/10 p-4 space-y-3">
          <p className="text-[13px] font-semibold text-[var(--text-0)]">
            سينتهي اشتراكك بعد آخر يوم مدفوع. متأكد؟
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="md"
              disabled={pending}
              onClick={handleDecline}
              className="flex-1 h-11 text-sm font-bold"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              نعم، لا أرغب في التجديد
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => setConfirmDecline(false)}
              className="h-11 text-sm font-semibold"
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={pending}
            onClick={handleRenew}
            className="flex-1 h-12 text-base font-bold gap-2"
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : null}
            جدّد اشتراكي
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => setConfirmDecline(true)}
            className="h-12 text-sm font-semibold text-[var(--text-1)]"
          >
            لا أرغب في التجديد
          </Button>
        </div>
      )}
    </div>
  );
}
