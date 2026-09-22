'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Loader2, MapPin, Navigation, Phone, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { directionsUrl } from '@/lib/geo';
import { completeWashVisit, skipWashVisit, undoWashVisit } from '../actions';

type VisitStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED';
type SkipReason = 'CAR_ABSENT' | 'CUSTOMER_TRAVEL' | 'WEATHER' | 'OTHER';

export interface TodayVisit {
  id: string;
  status: VisitStatus;
  skipReason: string | null;
  customerName: string;
  phone: string;
  car: string;
  plateNo: string | null;
  location: string;
  locationNotes: string | null;
  lat: number | null;
  lng: number | null;
}

const REASONS: Array<{ value: SkipReason; label: string }> = [
  { value: 'CAR_ABSENT', label: 'سيارة غير موجودة' },
  { value: 'CUSTOMER_TRAVEL', label: 'العميل مسافر' },
  { value: 'WEATHER', label: 'طقس' },
  { value: 'OTHER', label: 'سبب آخر' },
];

const REASON_LABELS: Record<string, string> = {
  CAR_ABSENT: 'السيارة غير موجودة',
  CUSTOMER_TRAVEL: 'العميل مسافر',
  WEATHER: 'الطقس',
  OTHER: 'سبب آخر',
  HOLIDAY: 'عطلة رسمية',
};

export function TodayRoute({ visits }: { visits: TodayVisit[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {visits.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-5 py-14 text-center">
          <Check className="mx-auto size-9 text-ok" />
          <h2 className="mt-4 text-base font-bold text-[var(--text-0)]">لا توجد زيارات مستحقة الآن</h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">كل ما أُسند إليك اليوم مكتمل، أو لا توجد غسلات مدفوعة.</p>
        </div>
      ) : (
        visits.map((visit, index) => <VisitCard key={visit.id} visit={visit} order={index + 1} />)
      )}
    </div>
  );
}

function VisitCard({ visit, order }: { visit: TodayVisit; order: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(visit.status);
  const [reason, setReason] = useState(visit.skipReason);
  const [showReasons, setShowReasons] = useState(false);
  const collapsed = status !== 'PLANNED';

  function complete() {
    startTransition(async () => {
      const result = await completeWashVisit({ visitId: visit.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus('COMPLETED');
      setReason(null);
      toast.success(result.message ?? 'تم تسجيل الغسيل');
      router.refresh();
    });
  }

  function skip(skipReason: SkipReason) {
    startTransition(async () => {
      const result = await skipWashVisit({ visitId: visit.id, reason: skipReason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus('SKIPPED');
      setReason(skipReason);
      setShowReasons(false);
      toast.success(result.message ?? 'تم تسجيل التعذّر');
      router.refresh();
    });
  }

  function undo() {
    startTransition(async () => {
      const result = await undoWashVisit({ visitId: visit.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus('PLANNED');
      setReason(null);
      toast.success(result.message ?? 'تم التراجع');
      router.refresh();
    });
  }

  if (collapsed) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--text-2)]">
            {order}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-0)]">{visit.customerName}</p>
            <p className="truncate text-[12px] text-[var(--text-2)]">{visit.car}{visit.plateNo ? ` — ${visit.plateNo}` : ''}</p>
          </div>
          <Badge tone={status === 'COMPLETED' ? 'ok' : 'warn'}>
            {status === 'COMPLETED' ? 'تمّت' : REASON_LABELS[reason ?? ''] ?? 'تعذّرت'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={undo} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            تراجع
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[var(--line-strong)]">
      <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-4">
        <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-[var(--accent-ink)]">
          {order}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-[var(--text-0)]">{visit.customerName}</h2>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-1)]">
            {visit.car}
            {visit.plateNo && <span className="tnum ms-2" dir="ltr">{visit.plateNo}</span>}
          </p>
        </div>
        <a
          href={`tel:${visit.phone}`}
          aria-label={`اتصال بـ${visit.customerName}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-1)] text-accent transition-colors hover:bg-[var(--glass-strong)]"
        >
          <Phone className="size-5" />
        </a>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3.5">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <MapPin className="mt-0.5 size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6 text-[var(--text-0)]">{visit.location}</p>
              {visit.locationNotes && (
                <p className="mt-1 text-[13px] leading-6 text-[var(--text-1)]">{visit.locationNotes}</p>
              )}
            </div>
          </div>
          {visit.lat !== null && visit.lng !== null && (
            <a
              href={directionsUrl(visit.lat, visit.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'secondary' }),
                'shrink-0 gap-1.5 font-bold text-accent'
              )}
            >
              <Navigation className="size-4" />
              الاتجاهات
            </a>
          )}
        </div>

        <Button variant="success" size="lg" className="h-14 w-full text-base" onClick={complete} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          تم الغسيل
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-14 w-full"
          onClick={() => setShowReasons((value) => !value)}
          disabled={pending}
          aria-expanded={showReasons}
        >
          <TriangleAlert />
          تعذّر
          <ChevronDown className={showReasons ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </Button>

        {showReasons && (
          <div className="grid grid-cols-2 gap-2" aria-label="سبب تعذّر الغسيل">
            {REASONS.map((item) => (
              <Button
                key={item.value}
                variant="outline"
                className="h-auto min-h-14 whitespace-normal px-3 py-3 text-center leading-5"
                onClick={() => skip(item.value)}
                disabled={pending}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
