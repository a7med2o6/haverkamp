'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Route,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { checkGeolocationSupport, directionsUrl, getGeolocationErrorMessage } from '@/lib/geo';
import { waMeLink } from '@/lib/whatsapp';
import { completeWashVisit, saveWashVisitLocation, skipWashVisit, undoWashVisit } from '../actions';

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

export interface DateControlsInfo {
  dateFormatted: string;
  prevStr: string;
  nextStr: string;
  canPrev: boolean;
  canNext: boolean;
  isToday: boolean;
}

export interface TodayRouteProps {
  visits: TodayVisit[];
  isToday: boolean;
  doneCount: number;
  remainingCount: number;
  upcomingRound?: { dateStr: string; dateLabel: string; count: number } | null;
  routeLink?: string | null;
  totalPointsCount?: number;
  dateControls: DateControlsInfo;
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

export function TodayRoute({
  visits,
  isToday,
  doneCount,
  remainingCount,
  upcomingRound,
  routeLink,
  totalPointsCount,
  dateControls,
}: TodayRouteProps) {
  function scrollToNextPlanned() {
    const firstPlanned = visits.find((v) => v.status === 'PLANNED');
    if (firstPlanned) {
      const el = document.getElementById(`visit-card-${firstPlanned.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* شريط التحكم في اليوم مع العدادات في سطر مضغوط */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* أدوات التنقل بين التواريخ */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {dateControls.canPrev ? (
            <Link
              href={`/dashboard/wash/today?date=${dateControls.prevStr}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 px-2.5 gap-1 text-xs font-semibold')}
            >
              <ChevronRight className="size-4" />
              أمس
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled className="h-9 px-2.5 gap-1 text-xs font-semibold opacity-40">
              <ChevronRight className="size-4" />
              أمس
            </Button>
          )}

          <span className="px-2 text-xs sm:text-sm font-bold text-[var(--text-0)]">
            {dateControls.dateFormatted}
          </span>

          {dateControls.canNext ? (
            <Link
              href={`/dashboard/wash/today?date=${dateControls.nextStr}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 px-2.5 gap-1 text-xs font-semibold')}
            >
              غداً
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled className="h-9 px-2.5 gap-1 text-xs font-semibold opacity-40">
              غداً
              <ChevronLeft className="size-4" />
            </Button>
          )}

          {!dateControls.isToday && (
            <Link
              href="/dashboard/wash/today"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-9 ms-1 px-3 text-xs font-bold text-accent')}
            >
              اليوم
            </Link>
          )}
        </div>

        {/* عدادات الإنجاز والمتبقي */}
        <div className="flex items-center gap-3 tnum border-s border-[var(--line)] ps-3 ms-auto sm:ms-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-1)]">
            <CheckCircle2 className="size-4 text-ok shrink-0" />
            <span>المسجّل:</span>
            <span className="font-extrabold text-[var(--text-0)] text-sm">{doneCount}</span>
          </div>
          <span className="text-[var(--line)]">|</span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-1)]">
            <Clock3 className="size-4 text-accent shrink-0" />
            <span>المتبقّي:</span>
            <span className="font-extrabold text-[var(--text-0)] text-sm">{remainingCount}</span>
          </div>
        </div>
      </div>

      {/* زر رابط الجولة المجمعة على الخريطة */}
      {isToday && routeLink && (
        <div className="flex items-center justify-between gap-3">
          <a
            href={routeLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: 'primary' }),
              'w-full sm:w-auto h-12 gap-2 font-extrabold px-5 text-sm shadow-md'
            )}
          >
            <Route className="size-5 shrink-0" />
            <span>
              افتح الجولة على الخريطة
              {totalPointsCount && totalPointsCount > 10 ? ` (أول 10 سيارات من أصل ${totalPointsCount})` : ''}
            </span>
          </a>
        </div>
      )}

      {/* تنبيه إكتمال جولة اليوم */}
      {visits.length > 0 && remainingCount === 0 && (
        <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-ok/30 bg-ok/10 px-4 py-3 text-ok">
          <CheckCircle2 className="size-5 shrink-0" />
          <span className="text-sm font-bold">أنهيت جولة اليوم — تم تسجيل جميع الغسلات</span>
        </div>
      )}

      {/* قائمة البطاقات أو الشاشة الفارغة */}
      {visits.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface-1)] px-5 py-12 text-center shadow-sm">
          {upcomingRound ? (
            <>
              <Calendar className="mx-auto size-10 text-accent" />
              <h2 className="mt-3 text-base font-bold text-[var(--text-0)]">لا غسلات في هذا اليوم</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-1)]">
                جولتك القادمة:{' '}
                <span className="font-extrabold text-[var(--text-0)]">{upcomingRound.dateLabel}</span> —{' '}
                <span className="tnum font-extrabold text-accent">{upcomingRound.count}</span>{' '}
                {upcomingRound.count === 1
                  ? 'سيارة'
                  : upcomingRound.count === 2
                  ? 'سيارتان'
                  : upcomingRound.count <= 10
                  ? 'سيارات'
                  : 'سيارة'}
              </p>
              <div className="mt-5">
                <Link
                  href={`/dashboard/wash/today?date=${upcomingRound.dateStr}`}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  الانتقال إلى الجولة القادمة
                </Link>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto size-10 text-ok" />
              <h2 className="mt-3 text-base font-bold text-[var(--text-0)]">لا توجد غسلات مجدولة في هذا اليوم</h2>
              <p className="mt-1 text-sm text-[var(--text-2)]">ولا توجد جولات قادمة مسندة إليك حالياً.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pb-28">
          {visits.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              order={index + 1}
              isToday={isToday}
            />
          ))}
        </div>
      )}

      {/* الشريط السفلي العائم والتفاعلي (يظهر فقط في اليوم الحالي عند وجود غسلات متبقية) */}
      {isToday && remainingCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-3 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-0)]">
              <span className="text-[var(--text-2)]">التقدّم:</span>
              <span className="tnum font-extrabold text-accent">
                {doneCount} من {visits.length}
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={scrollToNextPlanned}
              className="gap-2 font-extrabold px-6"
            >
              التالية
              <ChevronDown className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/*
  الأزرار التفاعلية (تسجيل الغسيل، التعذر، التراجع، حفظ/تحديث الموقع)
  تظهر فقط عندما يكون اليوم المعروض هو اليوم الحقيقي (isToday). في أي يوم
  آخر (أمس أو غداً) تكون البطاقات للعرض فقط، لأن الخادم يرفض العمليات
  الميدانية خارج يومها بحسب visitMutationContext.
*/
function VisitCard({
  visit,
  order,
  isToday,
}: {
  visit: TodayVisit;
  order: number;
  isToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState(visit.status);
  const [reason, setReason] = useState(visit.skipReason);
  const [showReasons, setShowReasons] = useState(false);

  const collapsed = status !== 'PLANNED';

  const waMsg = `مرحباً ${visit.customerName}، فريق هافركامب لغسيل السيارات في الطريق إليك لغسيل سيارتك (${visit.car}).`;
  const waUrl = waMeLink(visit.phone, waMsg);

  function handleCaptureLocation() {
    if (!isToday) return;
    const supportError = checkGeolocationSupport();
    if (supportError) {
      toast.error(supportError);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          try {
            const result = await saveWashVisitLocation({
              visitId: visit.id,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            const accuracy = Math.round(position.coords.accuracy);
            toast.success(`حُفظ الموقع — دقّة ±${accuracy} م`);
            router.refresh();
          } finally {
            setLocating(false);
          }
        });
      },
      (error) => {
        setLocating(false);
        toast.error(getGeolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function complete() {
    if (!isToday) return;
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
    if (!isToday) return;
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
    if (!isToday) return;
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
      <Card id={`visit-card-${visit.id}`} className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--text-2)]">
            {order}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-0)]">{visit.customerName}</p>
            <p className="truncate text-[12px] text-[var(--text-2)]" dir="ltr">
              {visit.car}
              {visit.plateNo ? ` · ${visit.plateNo}` : ''}
            </p>
          </div>
          <Badge tone={status === 'COMPLETED' ? 'ok' : 'warn'}>
            {status === 'COMPLETED' ? 'تمّت' : REASON_LABELS[reason ?? ''] ?? 'تعذّرت'}
          </Badge>

          {/* أزرار الاتصال والواتساب في البطاقة المطوية */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`tel:${visit.phone}`}
              aria-label={`اتصال بـ${visit.customerName}`}
              className="flex size-9 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-1)] text-accent hover:bg-[var(--glass-strong)]"
            >
              <Phone className="size-4" />
            </a>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`واتساب لـ${visit.customerName}`}
                className="flex size-9 items-center justify-center rounded-full border border-ok/30 bg-ok/10 text-ok hover:bg-ok/20"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>

          {isToday && (
            <Button variant="ghost" size="sm" onClick={undo} disabled={pending}>
              {pending ? <Loader2 className="animate-spin size-4" /> : <RotateCcw className="size-4" />}
              تراجع
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card id={`visit-card-${visit.id}`} className="overflow-hidden border-[var(--line-strong)]">
      <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-4">
        <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-[var(--accent-ink)]">
          {order}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-[var(--text-0)]">{visit.customerName}</h2>
          {/*
            اسم السيارة لاتيني ورقم اللوحة لاتيني، وبينهما نصٌّ عربي: تُركا
            متجاورين فالتصقا حتى قُرئا شيئاً واحداً — «Nissan Patrol 3-33333».
            فصار لكلٍّ صندوقه، وللّوحة إطارٌ يفصلها بالعين لا بالمسافة.
          */}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--text-1)]">
            <span dir="ltr">{visit.car}</span>
            {visit.plateNo && (
              <span
                className="tnum rounded-[var(--radius-sm)] border border-[var(--line-strong)] px-1.5 py-0.5 text-[12px] text-[var(--text-0)]"
                dir="ltr"
              >
                {visit.plateNo}
              </span>
            )}
          </p>
        </div>

        {/* أزرار الاتصال والواتساب بحجم مناسب لإبهام يد واحدة */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${visit.phone}`}
            aria-label={`اتصال بـ${visit.customerName}`}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-1)] text-accent transition-colors hover:bg-[var(--glass-strong)]"
          >
            <Phone className="size-5" />
          </a>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`واتساب لـ${visit.customerName}`}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-ok/30 bg-ok/10 text-ok transition-colors hover:bg-ok/20"
            >
              <MessageCircle className="size-5" />
            </a>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* صندوق الموقع والتوجيه */}
        <div className="space-y-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
          <div className="flex items-start gap-3 min-w-0 sm:flex-1">
            <MapPin className="mt-0.5 size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6 text-[var(--text-0)]">{visit.location}</p>
              {visit.locationNotes && (
                <p className="mt-1 text-[13px] leading-6 text-[var(--text-1)]">{visit.locationNotes}</p>
              )}
            </div>
          </div>
          {visit.lat !== null && visit.lng !== null ? (
            <div className="flex items-center justify-between gap-2 sm:justify-end sm:shrink-0">
              <a
                href={directionsUrl(visit.lat, visit.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'gap-1.5 font-bold text-accent'
                )}
              >
                <Navigation className="size-4" />
                الاتجاهات
              </a>
              {isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCaptureLocation}
                  disabled={pending || locating}
                  className="gap-1 text-[12px] text-[var(--text-2)] hover:text-[var(--text-0)]"
                >
                  {locating ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
                  تحديث الموقع
                </Button>
              )}
            </div>
          ) : isToday ? (
            <Button
              variant="secondary"
              onClick={handleCaptureLocation}
              disabled={pending || locating}
              className="w-full gap-1.5 font-bold text-accent sm:w-auto sm:shrink-0"
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              احفظ موقع هذه السيارة
            </Button>
          ) : (
            <span className="text-xs text-[var(--text-2)]">لم يُحفظ الموقع بعد</span>
          )}
        </div>

        {/* أزرار التسجيل تظهر فقط في اليوم الحالي (isToday) */}
        {isToday && (
          <>
            <Button
              variant="success"
              size="lg"
              className="h-14 w-full text-base font-extrabold"
              onClick={complete}
              disabled={pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check className="size-5" />}
              تم الغسيل
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="h-14 w-full font-bold"
              onClick={() => setShowReasons((value) => !value)}
              disabled={pending}
              aria-expanded={showReasons}
            >
              <TriangleAlert className="size-5" />
              تعذّر
              <ChevronDown className={showReasons ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </Button>

            {showReasons && (
              <div className="grid grid-cols-2 gap-2" aria-label="سبب تعذّر الغسيل">
                {REASONS.map((item) => (
                  <Button
                    key={item.value}
                    variant="outline"
                    className="h-auto min-h-14 whitespace-normal px-3 py-3 text-center leading-5 font-semibold"
                    onClick={() => skip(item.value)}
                    disabled={pending}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
