'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckCircle2, Loader2, LogOut, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { formatDateOnly, formatKWD } from '@/lib/utils';
import { waMeLink } from '@/lib/whatsapp';
import type { RenewalRow, RenewalState } from '../renewal-service';
import { markRenewalNotified, renewWashSubscription } from '../actions';

const RENEWAL_STATE_CONFIG: Record<
  RenewalState,
  { label: string; tone: 'neutral' | 'accent' | 'ok' | 'muted' | 'danger' }
> = {
  NOT_SENT: { label: 'لم يُرسل', tone: 'neutral' },
  SENT: { label: 'أُرسل', tone: 'accent' },
  REMINDED: { label: 'ذُكّر', tone: 'accent' },
  RENEWED: { label: 'جدّد', tone: 'ok' },
  DECLINED: { label: 'لا يرغب', tone: 'muted' },
  NO_REPLY: { label: 'لم يردّ', tone: 'danger' },
};

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'اليوم';
  if (daysLeft === 1) return 'بعد يوم';
  if (daysLeft === 2) return 'بعد يومين';
  if (daysLeft > 2) return `بعد ${daysLeft} أيام`;
  if (daysLeft === -1) return 'انتهى منذ يوم';
  if (daysLeft === -2) return 'انتهى منذ يومين';
  return `انتهى منذ ${Math.abs(daysLeft)} أيام`;
}

/**
 * لوحة تجديدات الاشتراكات في أعلى صفحة التحصيل لموظفي الإدارة.
 *
 * تتيح متابعة العقود القريبة من نهاية فترتها الحالية وإرسال التذكيرات عبر
 * الواتساب يدويًا أو تجديد الاشتراك أو الانقال لإنهائه.
 */
export function RenewalBoard({
  rows,
  canWrite,
}: {
  rows: RenewalRow[];
  canWrite: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-accent" />
          <h3 className="text-base font-bold text-[var(--text-0)]">تجديدات هذا الأسبوع</h3>
          <span className="tnum text-xs font-semibold text-[var(--text-2)]">({rows.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 ms-auto">
          {(Object.keys(RENEWAL_STATE_CONFIG) as RenewalState[]).map((st) => {
            const count = rows.filter((r) => r.state === st).length;
            if (count === 0) return null;
            const cfg = RENEWAL_STATE_CONFIG[st];
            return (
              <Badge key={st} tone={cfg.tone}>
                {cfg.label}: <span className="tnum font-bold ms-0.5">{count}</span>
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardBody className="p-4 sm:p-5 space-y-3">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-2)] space-y-2">
            <CalendarClock className="mx-auto size-8 opacity-40" />
            <p className="text-[14px] font-medium text-[var(--text-1)]">لا عقود تنتهي هذا الأسبوع.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {rows.map((row) => (
              <RenewalRowCard key={row.subscriptionId} row={row} canWrite={canWrite} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RenewalRowCard({ row, canWrite }: { row: RenewalRow; canWrite: boolean }) {
  const router = useRouter();
  const [pendingNotified, startNotifiedTransition] = useTransition();
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [pendingRenew, startRenewTransition] = useTransition();

  const stateCfg = RENEWAL_STATE_CONFIG[row.state] ?? { label: row.state, tone: 'neutral' };
  const showActions = canWrite && row.state !== 'RENEWED' && row.state !== 'DECLINED';

  function handleWhatsApp() {
    const link = row.phone ? waMeLink(row.phone, row.manualText) : null;
    /* فتح نافذة التبويب فوراً متزامناً لتفادي حجب المتصفح للنوافذ التلقائية */
    const tab = link ? window.open('', '_blank') : null;

    startNotifiedTransition(async () => {
      try {
        await markRenewalNotified({ periodId: row.period.id });
        if (link && tab) {
          tab.location.href = link;
        } else if (tab) {
          tab.close();
        }

        if (!link) {
          try {
            await navigator.clipboard.writeText(row.manualText);
            toast.success('لا رقم هاتف — تم نسخ نص الرسالة');
          } catch {
            toast.message('نص التذكير', { description: row.manualText });
          }
        } else {
          toast.success('سُجّل إرسال التذكير');
        }
        router.refresh();
      } catch {
        if (tab) tab.close();
        toast.error('تعذّر إرسال التذكير');
      }
    });
  }

  function handleRenewConfirm() {
    startRenewTransition(async () => {
      try {
        const res = await renewWashSubscription({ id: row.subscriptionId });
        toast.success((res as { message?: string }).message || 'تم تجديد الاشتراك');
        setShowRenewModal(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذّر تجديد الاشتراك';
        toast.error(msg);
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-[14px] text-[var(--text-0)]">{row.customerName}</h4>
            <span className="tnum text-[12px] font-semibold text-[var(--text-2)]" dir="ltr">
              {row.code}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-1)]">
            <span>{row.car}</span>
            {row.plateNo && (
              <span
                className="tnum rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-0)] border border-[var(--line)]"
                dir="ltr"
              >
                {row.plateNo}
              </span>
            )}
          </div>
        </div>

        <Badge tone={stateCfg.tone}>{stateCfg.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5 text-[13px]">
        <div>
          <span className="text-[var(--text-2)]">ينتهي </span>
          <span className="tnum font-semibold text-[var(--text-0)]">
            {formatDateOnly(row.period.to)}
          </span>
          <span className="ms-1.5 text-xs text-[var(--text-2)]">({daysLeftLabel(row.daysLeft)})</span>
        </div>
        <div className="tnum font-bold text-[var(--text-0)]">{formatKWD(row.price)}</div>
      </div>

      {showActions && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleWhatsApp}
            disabled={pendingNotified}
            className="gap-1.5"
          >
            {pendingNotified ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5 text-accent" />
            )}
            واتساب
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowRenewModal(true)}
            disabled={pendingRenew}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            جدّد الآن
          </Button>

          <Link
            href={`/dashboard/wash/${row.subscriptionId}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <LogOut className="size-3.5" />
            إنهاء
          </Link>
        </div>
      )}

      {showRenewModal && (
        <Modal
          open={showRenewModal}
          onClose={() => setShowRenewModal(false)}
          title="تأكيد تجديد الاشتراك"
          description={`تجديد اشتراك ${row.customerName} (${row.code}) وتفعيل الشهر الجديد`}
        >
          <div className="space-y-4 py-2">
            <p className="text-[14px] text-[var(--text-0)]">
              سيتم فتح الفترة الجديدة فوراً لـ <strong className="text-accent">{row.customerName}</strong> بقيمة{' '}
              <strong className="tnum text-accent">{formatKWD(row.price)}</strong>. وتكون الغسلات محظورة حتى سداد الفاتورة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenewModal(false)}
                disabled={pendingRenew}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleRenewConfirm}
                disabled={pendingRenew}
                className="gap-2 font-bold"
              >
                {pendingRenew ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                تأكيد التجديد
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
