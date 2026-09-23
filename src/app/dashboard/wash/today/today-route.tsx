'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
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
import { cn, formatDateOnly, todayDateOnly } from '@/lib/utils';
import { checkGeolocationSupport, directionsUrl, getGeolocationErrorMessage } from '@/lib/geo';
import { waMeLink } from '@/lib/whatsapp';
import { completeWashVisit, saveWashVisitLocation, skipWashVisit, undoWashVisit } from '../actions';
import { isMakeupEligible } from '../makeup';
import { MakeupPanel } from '../makeup-panel';

type VisitStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED';
type SkipReason = 'CAR_ABSENT' | 'CUSTOMER_TRAVEL' | 'WEATHER' | 'OPERATIONAL' | 'OTHER';

export interface TodayVisit {
  id: string;
  dueDate: Date;
  scheduledDate: Date;
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
  assignedEmployee?: { id: string; fullName: string } | null;
}

export interface DateControlsInfo {
  dateFormatted: string;
  prevStr: string;
  nextStr: string;
  canPrev: boolean;
  canNext: boolean;
  isToday: boolean;
  currentDateStr: string;
}

export interface OverdueDayInfo {
  dateStr: string;
  dateLabel: string;
  count: number;
  isNavigable: boolean;
}

export interface OverdueBannerInfo {
  days: OverdueDayInfo[];
  totalCount: number;
}

export interface WasherChipInfo {
  id: string;
  fullName: string;
  count: number;
}

export interface WasherFilterInfo {
  chips: WasherChipInfo[];
  unassignedCount: number;
  selectedWasher: string | null;
  totalDayVisitsCount: number;
}

export interface TodayRouteProps {
  visits: TodayVisit[];
  isToday: boolean;
  canRecord: boolean;
  canReschedule?: boolean;
  doneCount: number;
  remainingCount: number;
  upcomingRound?: { dateStr: string; dateLabel: string; count: number } | null;
  routeLink?: string | null;
  totalPointsCount?: number;
  dateControls: DateControlsInfo;
  isSupervisor?: boolean;
  overdueBannerInfo?: OverdueBannerInfo;
  washerFilterInfo?: WasherFilterInfo;
}

const WASHER_REASONS: Array<{ value: SkipReason; label: string }> = [
  { value: 'CAR_ABSENT', label: 'سيارة غير موجودة' },
  { value: 'CUSTOMER_TRAVEL', label: 'العميل مسافر' },
  { value: 'WEATHER', label: 'طقس' },
  { value: 'OTHER', label: 'سبب آخر' },
];

const SUPERVISOR_REASONS: Array<{ value: SkipReason; label: string }> = [
  { value: 'CAR_ABSENT', label: 'سيارة غير موجودة' },
  { value: 'CUSTOMER_TRAVEL', label: 'العميل مسافر' },
  { value: 'WEATHER', label: 'طقس' },
  { value: 'OPERATIONAL', label: 'من جهتنا (لم يحضر الغسّيل)' },
  { value: 'OTHER', label: 'سبب آخر' },
];

const REASON_LABELS: Record<string, string> = {
  CAR_ABSENT: 'السيارة غير موجودة',
  CUSTOMER_TRAVEL: 'العميل مسافر',
  WEATHER: 'الطقس',
  OPERATIONAL: 'من جهتنا (لم يحضر الغسّيل)',
  OTHER: 'سبب آخر',
  HOLIDAY: 'عطلة رسمية',
};

export function TodayRoute({
  visits,
  isToday,
  canRecord,
  canReschedule = false,
  doneCount,
  remainingCount,
  upcomingRound,
  routeLink,
  totalPointsCount,
  dateControls,
  isSupervisor = false,
  overdueBannerInfo,
  washerFilterInfo,
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

  // الاحتفاظ بالفلتر washer عند التنقل بين الأيام
  const selectedWasher = washerFilterInfo?.selectedWasher;
  const washerParam = selectedWasher ? `&washer=${selectedWasher}` : '';

  // تجميع البطاقات حسب الغسّال عند اختيار «الكل» في وضع المشرف
  const isGroupedByWasher = isSupervisor && selectedWasher === null && visits.length > 0;

  interface WasherGroup {
    key: string;
    title: string;
    done: number;
    total: number;
    visits: TodayVisit[];
  }

  const groups: WasherGroup[] = [];
  if (isGroupedByWasher) {
    const map = new Map<string, WasherGroup>();

    visits.forEach((visit) => {
      const key = visit.assignedEmployee ? visit.assignedEmployee.id : 'unassigned';
      const title = visit.assignedEmployee ? visit.assignedEmployee.fullName : 'غير مسند';

      let group = map.get(key);
      if (!group) {
        group = { key, title, done: 0, total: 0, visits: [] };
        map.set(key, group);
      }
      group.visits.push(visit);
      group.total++;
      if (visit.status !== 'PLANNED') {
        group.done++;
      }
    });

    const sortedGroups = Array.from(map.values()).sort((a, b) => {
      if (a.key === 'unassigned') return 1;
      if (b.key === 'unassigned') return -1;
      return a.title.localeCompare(b.title, 'ar');
    });
    groups.push(...sortedGroups);
  }

  return (
    <div className="space-y-4">
      {/* شريط تنبيه الغسلات المتأخرة (للمشرف فقط) */}
      {isSupervisor && overdueBannerInfo && overdueBannerInfo.totalCount > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-warn/40 bg-warn/10 p-4 text-[var(--text-0)] space-y-2.5 shadow-sm">
          <div className="flex items-center gap-2 font-extrabold text-sm text-[var(--text-0)]">
            <AlertTriangle className="size-5 text-warn shrink-0" />
            {/* العربية لا تقرن العدد بالمفرد والمثنّى: «غسلتان» لا «2 غسلتان» */}
            <span>
              {overdueBannerInfo.totalCount === 1
                ? 'غسلة فات يومها ولم تُسجّل'
                : overdueBannerInfo.totalCount === 2
                  ? 'غسلتان فات يومهما ولم تُسجّلا'
                  : `${overdueBannerInfo.totalCount} ${
                      overdueBannerInfo.totalCount <= 10 ? 'غسلات' : 'غسلة'
                    } فات يومها ولم تُسجّل`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {overdueBannerInfo.days.map((day) =>
              day.isNavigable ? (
                <Link
                  key={day.dateStr}
                  href={`/dashboard/wash/today?date=${day.dateStr}${washerParam}`}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-warn/50 bg-[var(--surface-1)] px-3 py-1 text-xs font-bold text-warn hover:bg-warn/15 transition-colors"
                >
                  <span>{day.dateLabel}</span>
                  <span className="tnum font-extrabold text-danger">({day.count})</span>
                </Link>
              ) : (
                <span
                  key={day.dateStr}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text-2)]"
                >
                  <span>{day.dateLabel}</span>
                  <span className="tnum font-bold text-[var(--text-1)]">({day.count})</span>
                  <span className="text-[11px] opacity-75">(عبر صفحة الاشتراك)</span>
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* شريط التحكم في اليوم مع العدادات في سطر مضغوط */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* أدوات التنقل بين التواريخ */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {dateControls.canPrev ? (
            <Link
              href={`/dashboard/wash/today?date=${dateControls.prevStr}${washerParam}`}
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
              href={`/dashboard/wash/today?date=${dateControls.nextStr}${washerParam}`}
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
              href={`/dashboard/wash/today${selectedWasher ? `?washer=${selectedWasher}` : ''}`}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'h-9 ms-1 px-3 text-xs font-bold text-accent')}
            >
              اليوم
            </Link>
          )}
        </div>

        {/* عدادات الإنجاز والمتبقي من المعروض */}
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

      {/* شريط فلترة الغسّالين (للمشرف فقط) */}
      {isSupervisor && washerFilterInfo && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/wash/today?date=${dateControls.currentDateStr}`}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors border',
              washerFilterInfo.selectedWasher === null
                ? 'border-accent bg-accent text-[var(--accent-ink)]'
                : 'border-[var(--line-strong)] bg-[var(--surface-1)] text-[var(--text-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)]'
            )}
          >
            <span>الكل</span>
            <span className="tnum text-[11px] font-extrabold">({washerFilterInfo.totalDayVisitsCount})</span>
          </Link>

          {washerFilterInfo.chips.map((w) => (
            <Link
              key={w.id}
              href={`/dashboard/wash/today?date=${dateControls.currentDateStr}&washer=${w.id}`}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors border',
                washerFilterInfo.selectedWasher === w.id
                  ? 'border-accent bg-accent text-[var(--accent-ink)]'
                  : 'border-[var(--line-strong)] bg-[var(--surface-1)] text-[var(--text-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)]'
              )}
            >
              <span>{w.fullName}</span>
              <span className="tnum text-[11px] font-extrabold">({w.count})</span>
            </Link>
          ))}

          {washerFilterInfo.unassignedCount > 0 && (
            <Link
              href={`/dashboard/wash/today?date=${dateControls.currentDateStr}&washer=unassigned`}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors border',
                washerFilterInfo.selectedWasher === 'unassigned'
                  ? 'border-warn bg-warn text-[var(--surface-1)]'
                  : 'border-warn/40 bg-warn/10 text-warn hover:bg-warn/20'
              )}
            >
              <TriangleAlert className="size-3.5" />
              <span>غير مسند</span>
              <span className="tnum text-[11px] font-extrabold">({washerFilterInfo.unassignedCount})</span>
            </Link>
          )}
        </div>
      )}

      {/* زر رابط الجولة المجمعة على الخريطة (يظهر عند تحديد غسّال واحد وفي اليوم الحالي) */}
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
                  href={`/dashboard/wash/today?date=${upcomingRound.dateStr}${washerParam}`}
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
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {isSupervisor
                  ? 'ولا توجد جولات قادمة مجدولة حالياً.'
                  : 'ولا توجد جولات قادمة مسندة إليك حالياً.'}
              </p>
            </>
          )}
        </div>
      ) : isGroupedByWasher ? (
        <div className="space-y-6 pb-28">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--line-strong)] pb-2 pt-1">
                <h3
                  className={cn(
                    'text-base font-extrabold flex items-center gap-2',
                    group.key === 'unassigned' ? 'text-warn' : 'text-[var(--text-0)]'
                  )}
                >
                  {group.key === 'unassigned' && <TriangleAlert className="size-4 shrink-0" />}
                  <span>{group.title}</span>
                </h3>
                <Badge tone={group.done === group.total ? 'ok' : 'neutral'}>
                  <span className="tnum font-bold">
                    تم {group.done} من {group.total}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {group.visits.map((visit, index) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    order={index + 1}
                    canRecord={canRecord}
                    canReschedule={canReschedule}
                    isSupervisor={isSupervisor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pb-28">
          {visits.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              order={index + 1}
              canRecord={canRecord}
              canReschedule={canReschedule}
              isSupervisor={isSupervisor}
            />
          ))}
        </div>
      )}

      {/* الشريط السفلي العائم (يظهر عند السماح بالتسجيل وجود غسلات متبقية) */}
      {canRecord && remainingCount > 0 && (
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
  الشاشة تعكس visitMutationContext في الخادم: لا تتيح إلا ما يقبله الخادم (canRecord).
  للغسّيل: canRecord = isToday.
  للمشرف: canRecord = viewedDate <= today.
*/
function VisitCard({
  visit,
  order,
  canRecord,
  canReschedule = false,
  isSupervisor = false,
}: {
  visit: TodayVisit;
  order: number;
  canRecord: boolean;
  canReschedule?: boolean;
  isSupervisor?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState(visit.status);
  const [reason, setReason] = useState(visit.skipReason);
  const [showReasons, setShowReasons] = useState(false);

  const today = todayDateOnly();
  const isMakeup = visit.scheduledDate.getTime() !== visit.dueDate.getTime();
  const eligibleForMakeup = isMakeupEligible(visit, today);

  const collapsed = status !== 'PLANNED';

  const waMsg = `مرحباً ${visit.customerName}، فريق هافركامب لغسيل السيارات في الطريق إليك لغسيل سيارتك (${visit.car}).`;
  const waUrl = waMeLink(visit.phone, waMsg);
  /*
    الالتقاط يأخذ موقع الجهاز نفسه، فهو موقع السيارة فقط حين يقف حاملُه
    عندها. المشرف يسجّل من مكتبه غالباً، فلو ضغط لحُفظ موقع المكتب نقطةً
    للسيارة — وموقعها يُضبط له من صفحة الاشتراك.
  */
  const canCapture = canRecord && !isSupervisor;

  function handleCaptureLocation() {
    if (!canCapture) return;
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
    if (!canRecord) return;
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
    if (!canRecord) return;
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
    if (!canRecord) return;
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

  const reasonsList = isSupervisor ? SUPERVISOR_REASONS : WASHER_REASONS;

  if (collapsed) {
    return (
      <Card id={`visit-card-${visit.id}`} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--text-2)]">
            {order}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-bold text-[var(--text-0)]">{visit.customerName}</p>
              {isMakeup && (
                <Badge tone="accent" className="text-[10px]">
                  تعويض عن {formatDateOnly(visit.dueDate)}
                </Badge>
              )}
            </div>
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

          {isSupervisor && canReschedule && eligibleForMakeup && (
            <MakeupPanel visitId={visit.id} />
          )}

          {canRecord && (
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-[var(--text-0)]">{visit.customerName}</h2>
            {isMakeup && (
              <Badge tone="accent">
                تعويض عن {formatDateOnly(visit.dueDate)}
              </Badge>
            )}
          </div>
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
              {canCapture && (
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
          ) : canCapture ? (
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

        {/* أزرار التسجيل والتعويض للمشرف */}
        {isSupervisor && canReschedule && eligibleForMakeup && (
          <div className="pt-2 border-t border-[var(--line)]">
            <MakeupPanel visitId={visit.id} />
          </div>
        )}

        {canRecord && (
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
                {reasonsList.map((item) => (
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
