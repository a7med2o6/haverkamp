import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, ChevronDown, Navigation } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { withFrom } from '@/lib/back-link';
import { cn, formatDateOnly, formatKWD, formatWeekday, todayDateOnly, toNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddPauseCollapsible, DeletePauseButton } from './pause-controls';
import { ShareWashButton } from './share-button';
import { washLocationLine } from '@/app/dashboard/wash/location';
import { directionsUrl } from '@/lib/geo';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site-url';
import { isMakeupEligible } from '../makeup';
import { MakeupPanel } from '../makeup-panel';

export const dynamic = 'force-dynamic';

const VISIT_STATUS = {
  BLOCKED: { label: 'غير مسدّد', tone: 'muted' as const },
  PLANNED: { label: 'مخطّطة', tone: 'accent' as const },
  COMPLETED: { label: 'تمّت', tone: 'ok' as const },
  SKIPPED: { label: 'تعذّرت', tone: 'warn' as const },
};

const SKIP_REASON = {
  UNPAID: 'غير مسدّد',
  CAR_ABSENT: 'السيارة غير موجودة',
  CUSTOMER_TRAVEL: 'العميل مسافر',
  WEATHER: 'الطقس',
  HOLIDAY: 'عطلة رسمية',
  OPERATIONAL: 'من جهتنا (لم يحضر الغسّيل)',
  OTHER: 'سبب آخر',
};

/*
  سداد الفترة بقاعدتين معاً: فترةٌ صارت مستحقّة الغسيل (ELIGIBLE/CLOSED) مدفوعةٌ
  ولو جاءت بلا فاتورة، وإلا فالحكم لما دُفع من فاتورتها كما في شاشة التحصيل.
  ويقرأ الشريطُ ورؤوسُ الفترات من هنا وحده، فلا تقول الصفحة الواحدة حكمين.
*/
function periodPayment(period: {
  status: 'DUE' | 'ELIGIBLE' | 'CLOSED';
  priceSnapshot: Parameters<typeof toNumber>[0];
  order: {
    total: Parameters<typeof toNumber>[0];
    paidAmount: Parameters<typeof toNumber>[0];
  } | null;
}) {
  const due = toNumber(period.order?.total ?? period.priceSnapshot);
  const paid = toNumber(period.order?.paidAmount);
  const isPaid =
    period.status === 'ELIGIBLE' ||
    period.status === 'CLOSED' ||
    (period.order !== null && due > 0 && paid >= due);
  const badge = isPaid
    ? { label: 'مدفوع', tone: 'ok' as const }
    : paid > 0
      ? { label: 'جزئي', tone: 'warn' as const }
      : { label: 'غير مدفوع', tone: 'danger' as const };
  return { isPaid, badge };
}

function completedTime(value: Date | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuwait',
  }).format(value);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const subscription = await db.washSubscription.findUnique({
    where: { id },
    select: { code: true },
  });
  return { title: subscription?.code ?? 'تفاصيل الاشتراك' };
}

export default async function WashSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('wash:read');
  const { id } = await params;

  /*
    الغسلات تُقرأ عبر فتراتها لا بسقف عدديّ: السقف كان يقطع شهراً في منتصفه
    ويخلط حدود الأشهر، والفترة هي وحدة الفاتورة والسداد. ستّ فترات تكفي
    للنظر، والعدد الكلّي يُقال صراحةً حين يزيد.
  */
  const [subscription, totalPeriodsCount] = await Promise.all([
    db.washSubscription.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            plateNo: true,
          },
        },
        pauses: { orderBy: [{ fromDate: 'desc' }, { createdAt: 'desc' }] },
        defaultWasher: { select: { id: true, fullName: true, code: true } },
        periods: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 7,
          include: {
            order: {
              select: {
                id: true,
                number: true,
                total: true,
                paidAmount: true,
                status: true,
              },
            },
            visits: {
              orderBy: { scheduledDate: 'asc' },
              include: {
                assignedEmployee: { select: { id: true, fullName: true } },
                completedByEmployee: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    }),
    db.washSubscriptionPeriod.count({ where: { subscriptionId: id } }),
  ]);

  if (!subscription) notFound();

  const displayPeriods = subscription.periods.slice(0, 6);
  const defaultWasher = subscription.defaultWasher ?? null;

  const canWrite = can(session.user.role, 'wash:write');
  /*
    رابط الفاتورة يقتصر على الصلاحية pos:read؛ لأن صفحة تفاصيل الفواتير
    تتطلب هذه الصلاحية للدخول، وفي حال عدم امتلاكها تُعرض خانة الفاتورة كنص عادي.
  */
  const canPosRead = can(session.user.role, 'pos:read');

  const qrCodeSvg =
    canWrite && subscription.shareToken ? await qrSvg(`${siteUrl()}/w/${subscription.shareToken}`) : null;

  const subscriptionStatus = {
    ACTIVE: { label: 'سارٍ', tone: 'ok' as const },
    PAUSED: { label: 'موقوف', tone: 'warn' as const },
    ENDED: { label: 'منتهٍ', tone: 'muted' as const },
  }[subscription.status];

  const here = `/dashboard/wash/${subscription.id}`;
  const today = todayDateOnly();

  /*
    الشهر الحالي هو الذي يضم اليوم (fromDate <= today <= toDate)؛
    فإن لم يوجد فالفترة الأحدث في السجل بحسب (year, month) كما هو متبع في wash-card.ts.
  */
  let currentPeriod = subscription.periods.find((p) => p.fromDate <= today && today <= p.toDate);
  if (!currentPeriod && subscription.periods.length > 0) {
    currentPeriod = subscription.periods[0];
  }

  // حساب بيانات الشريط المالي لـ "الفترة الحالية"
  let currentPeriodStats = null;
  if (currentPeriod) {
    const renewsOn = new Date(currentPeriod.toDate.getTime() + 86_400_000);
    const msLeft = currentPeriod.toDate.getTime() - today.getTime();
    const daysLeft = Math.max(0, Math.round(msLeft / 86_400_000));

    const { isPaid, badge: paymentBadge } = periodPayment(currentPeriod);
    // فترةٌ لا تضمّ اليوم هي آخر ما فُتح، لا «الحالية» — والتسمية لا تكذب في ذلك.
    const containsToday = currentPeriod.fromDate <= today && today <= currentPeriod.toDate;

    const doneCount = currentPeriod.visits.filter((v) => v.status === 'COMPLETED').length;
    const totalVisits = currentPeriod.visits.length;
    const nextWash = currentPeriod.visits.find((v) => v.status === 'PLANNED' && v.scheduledDate >= today);

    currentPeriodStats = {
      renewsOn,
      daysLeft,
      containsToday,
      isPaid,
      paymentBadge,
      doneCount,
      totalVisits,
      nextWash,
    };
  }

  return (
    <>
      <Link
        href="/dashboard/wash"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى اشتراكات الغسيل
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="tnum text-2xl font-bold text-[var(--text-0)]" dir="ltr">
              {subscription.code}
            </h1>
            <Badge tone={subscriptionStatus.tone}>{subscriptionStatus.label}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[var(--text-1)]">
            <Link
              href={withFrom(`/dashboard/customers/${subscription.customer.id}`, here)}
              className="font-semibold text-[var(--text-0)] hover:text-accent hover:underline"
            >
              {subscription.customer.name}
            </Link>
            <span className="text-[var(--text-2)]">•</span>
            <span>
              {subscription.vehicle.make} {subscription.vehicle.model}
              {subscription.vehicle.year ? ` ${subscription.vehicle.year}` : ''}
            </span>
            {subscription.vehicle.plateNo && (
              <span
                className="tnum rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-2)] px-2 py-0.5 text-[12px] font-semibold text-[var(--text-0)]"
                dir="ltr"
              >
                {subscription.vehicle.plateNo}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {subscription.lat !== null && subscription.lng !== null && (
            <a
              href={directionsUrl(toNumber(subscription.lat), toNumber(subscription.lng))}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Navigation className="size-4" />
              الاتجاهات
            </a>
          )}
        </div>
      </div>

      {currentPeriod && currentPeriodStats ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-[12px] font-medium text-[var(--text-2)]">
              {currentPeriodStats.containsToday ? 'الفترة الحالية' : 'آخر فترة'}
            </p>
            <div className="my-1">
              <p className="tnum text-[14px] font-bold text-[var(--text-0)]">
                {formatDateOnly(currentPeriod.fromDate)} — {formatDateOnly(currentPeriod.toDate)}
              </p>
            </div>
            <p className="tnum text-[12px] text-[var(--text-2)]">
              يتجدّد في {formatDateOnly(currentPeriodStats.renewsOn)}
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-[12px] font-medium text-[var(--text-2)]">الأيام المتبقّية</p>
            <p className="tnum my-1 text-2xl font-bold text-[var(--text-0)]">{currentPeriodStats.daysLeft}</p>
            <p className="text-[12px] text-[var(--text-2)]">حتى نهاية الفترة</p>
          </div>

          <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-[12px] font-medium text-[var(--text-2)]">الفاتورة</p>
                <Badge tone={currentPeriodStats.paymentBadge.tone}>
                  {currentPeriodStats.paymentBadge.label}
                </Badge>
              </div>
              <p className="tnum mt-1 text-[14px] font-bold text-[var(--text-0)]" dir="ltr">
                {currentPeriod.order ? (
                  canPosRead ? (
                    <Link
                      href={withFrom(`/dashboard/invoices/${currentPeriod.order.id}`, here)}
                      className="text-accent hover:underline"
                    >
                      {currentPeriod.order.number}
                    </Link>
                  ) : (
                    currentPeriod.order.number
                  )
                ) : (
                  '—'
                )}
              </p>
            </div>
            {!currentPeriodStats.isPaid && (
              <p className="mt-1 text-[11px] font-medium text-danger">تبقى الغسلات معلّقة حتى السداد</p>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]">
            <div>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[12px] font-medium text-[var(--text-2)]">الغسلات</p>
                <span className="tnum text-[12px] font-bold text-[var(--text-0)]">
                  {currentPeriodStats.doneCount} من {currentPeriodStats.totalVisits}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${
                      currentPeriodStats.totalVisits > 0
                        ? Math.min(
                            100,
                            Math.round((currentPeriodStats.doneCount / currentPeriodStats.totalVisits) * 100)
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <p className="mt-2 truncate text-[12px] text-[var(--text-2)]">
              {currentPeriodStats.nextWash ? (
                <>
                  التالية:{' '}
                  <span className="font-semibold text-[var(--text-1)]">
                    {formatWeekday(currentPeriodStats.nextWash.scheduledDate)}{' '}
                    {formatDateOnly(currentPeriodStats.nextWash.scheduledDate)}
                  </span>
                </>
              ) : (
                'لا غسلات قادمة في هذه الفترة'
              )}
            </p>
          </div>
        </div>
      ) : (
        <Card className="mb-5 p-5 text-center text-[13px] text-[var(--text-2)]">
          لم تُفتح أي فترة اشتراك لهذا العقد بعد.
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>جدول الغسلات حسب الفترات</CardTitle>
                <CardDescription className="mt-1">
                  تُعرض أحدث 6 فترات اشتراك. الغسلات داخل كل فترة مرتبة من الأقدم للأحدث.
                </CardDescription>
              </div>
            </CardHeader>

            <CardBody className="p-0 divide-y divide-[var(--line)]">
              {displayPeriods.length === 0 ? (
                <p className="p-6 text-center text-[13px] text-[var(--text-2)]">لا توجد فترات مسجّلة بعد.</p>
              ) : (
                displayPeriods.map((period) => {
                  const isCurrent = currentPeriod?.id === period.id;
                  const isFuture = period.fromDate > today;
                  const isOpen = isCurrent || isFuture;

                  const pBadge = periodPayment(period).badge;

                  const pDoneCount = period.visits.filter((v) => v.status === 'COMPLETED').length;
                  const pTotalCount = period.visits.length;

                  return (
                    <details key={period.id} open={isOpen} className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 bg-[var(--surface-2)] px-4 py-3.5 hover:bg-[var(--glass-strong)] list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <ChevronDown className="size-4 shrink-0 text-[var(--text-2)] transition-transform group-open:rotate-180" />
                          <span className="tnum font-semibold text-[var(--text-0)] text-[14px]">
                            {formatDateOnly(period.fromDate)} — {formatDateOnly(period.toDate)}
                          </span>
                          {isCurrent && currentPeriodStats?.containsToday && (
                            <Badge tone="accent">الفترة الحالية</Badge>
                          )}
                          {isFuture && <Badge tone="info">فترة قادمة</Badge>}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[12px]">
                          {period.order && (
                            <span className="tnum text-[var(--text-1)] font-medium" dir="ltr">
                              {period.order.number}
                            </span>
                          )}
                          <Badge tone={pBadge.tone}>{pBadge.label}</Badge>
                          <span className="tnum font-semibold text-[var(--text-0)]">
                            {pDoneCount} / {pTotalCount} غسلة
                          </span>
                        </div>
                      </summary>

                      <div className="p-4 bg-[var(--surface-1)]">
                        {period.visits.length === 0 ? (
                          <p className="py-4 text-center text-[13px] text-[var(--text-2)]">
                            لا توجد غسلات بعد
                          </p>
                        ) : (
                          <div className="grid items-start gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                            {period.visits.map((visit) => {
                              const isToday = visit.scheduledDate.getTime() === today.getTime();
                              const isMakeup = visit.scheduledDate.getTime() !== visit.dueDate.getTime();
                              const eligibleForMakeup = isMakeupEligible(visit, today);
                              const visitStatus = VISIT_STATUS[visit.status];
                              const washer = visit.completedByEmployee ?? visit.assignedEmployee;
                              /*
                                يُعرض اسم الغسّيل على الغسلة فقط حين يختلف عن الغسّيل المعتاد للاشتراك،
                                تجنباً للتكرار البصري غير المفيد في كافة الأسطر عند قيام الموظف نفسه بالعمل.
                              */
                              const showWasher = washer && (!defaultWasher || washer.id !== defaultWasher.id);
                              // سطرٌ فارغ تحت كل غسلة مخطّطة يطيل القائمة بلا خبر.
                              const hasMeta =
                                (visit.status === 'SKIPPED' && !!visit.skipReason) ||
                                (visit.status === 'COMPLETED' && !!visit.completedAt) ||
                                !!showWasher ||
                                isToday;

                              return (
                                <div
                                  key={visit.id}
                                  className={cn(
                                    'rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2.5 text-[13px] flex flex-col justify-between',
                                    isToday && 'ring-2 ring-accent border-accent bg-accent/5'
                                  )}
                                >
                                  <div>
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-[var(--text-0)]">
                                          {formatWeekday(visit.scheduledDate)}
                                        </span>
                                        <span className="tnum text-[12px] text-[var(--text-2)]">
                                          {formatDateOnly(visit.scheduledDate)}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        {isMakeup && (
                                          <Badge tone="accent">
                                            تعويض عن {formatDateOnly(visit.dueDate)}
                                          </Badge>
                                        )}
                                        <Badge tone={visitStatus.tone}>{visitStatus.label}</Badge>
                                      </div>
                                    </div>

                                    {hasMeta && (
                                      <div className="mt-2 space-y-1 text-[12px] text-[var(--text-2)]">
                                        {visit.status === 'SKIPPED' && visit.skipReason && (
                                          <p className="text-warn font-medium">
                                            السبب: {SKIP_REASON[visit.skipReason]}
                                          </p>
                                        )}
                                        {visit.status === 'COMPLETED' && visit.completedAt && (
                                          <p className="tnum">تمّت: {completedTime(visit.completedAt)}</p>
                                        )}
                                        {showWasher && (
                                          <p className="text-[var(--text-1)]">
                                            الغسّيل: <span className="font-medium">{washer.fullName}</span>
                                          </p>
                                        )}
                                        {isToday && (
                                          <p className="text-[11px] font-bold text-accent">غسلة اليوم</p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {canWrite && eligibleForMakeup && (
                                    <div className="mt-2.5 pt-2 border-t border-[var(--line)]">
                                      <MakeupPanel visitId={visit.id} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })
              )}
            </CardBody>

            {totalPeriodsCount > 6 && (
              <div className="border-t border-[var(--line)] px-5 py-3 text-center text-[12px] text-[var(--text-2)]">
                تُعرض آخر 6 فترات من إجمالي {totalPeriodsCount} فترة.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل العقد</CardTitle>
            </CardHeader>
            <CardBody className="p-4">
              <dl className="divide-y divide-[var(--line)] text-[13px]">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[var(--text-2)]">الاشتراك الشهري</dt>
                  <dd className="tnum font-semibold text-[var(--text-0)]">
                    {formatKWD(toNumber(subscription.monthlyPrice))}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[var(--text-2)]">الغسّيل المعتاد</dt>
                  <dd className="font-medium text-[var(--text-0)]">
                    {defaultWasher ? `${defaultWasher.fullName} — ${defaultWasher.code}` : 'غير محدد'}
                  </dd>
                </div>

                <div className="py-2.5 flex flex-col gap-1">
                  <dt className="text-[var(--text-2)]">موقع الخدمة</dt>
                  <dd className="font-medium text-[var(--text-0)]">{washLocationLine(subscription)}</dd>
                  {subscription.locationNotes && (
                    <dd className="text-[12px] text-[var(--text-2)]">{subscription.locationNotes}</dd>
                  )}
                  <dd className="text-[12px] text-[var(--text-2)] mt-0.5">
                    {subscription.lat !== null && subscription.lng !== null
                      ? 'تم تحديد الموقع على الخريطة'
                      : 'الموقع غير محدد على الخريطة'}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-[var(--text-2)]">تاريخ بدء العقد</dt>
                  <dd className="tnum font-medium text-[var(--text-0)]">
                    {formatDateOnly(subscription.startDate)}
                  </dd>
                </div>

                {subscription.endDate && (
                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <dt className="text-[var(--text-2)]">تاريخ الانتهاء</dt>
                    <dd className="tnum font-medium text-[var(--text-0)]">
                      {formatDateOnly(subscription.endDate)}
                    </dd>
                  </div>
                )}

                {subscription.notes && (
                  <div className="py-2.5 flex flex-col gap-1">
                    <dt className="text-[var(--text-2)]">ملاحظات العقد</dt>
                    <dd className="text-[12px] text-[var(--text-0)]">{subscription.notes}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle>بطاقة العميل</CardTitle>
              </CardHeader>
              <CardBody className="p-4">
                <div className="flex items-center gap-3.5">
                  {qrCodeSvg && (
                    <div
                      className="size-24 shrink-0 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-1.5 [&_svg]:size-full"
                      dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                    />
                  )}
                  <div className="space-y-2">
                    <p className="text-[12px] leading-5 text-[var(--text-2)]">
                      رابط متابعة الغسلات للعميل لمشاركته عبر الواتساب أو مسحه.
                    </p>
                    <ShareWashButton subscriptionId={subscription.id} />
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>الإيقافات</CardTitle>
                <Badge tone="neutral">{subscription.pauses.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              {canWrite && <AddPauseCollapsible subscriptionId={subscription.id} />}
              {subscription.pauses.length === 0 ? (
                <p className="py-3 text-center text-[13px] text-[var(--text-2)]">لا توجد إيقافات مسجّلة.</p>
              ) : (
                <ul className="space-y-2">
                  {subscription.pauses.map((pause) => (
                    <li key={pause.id} className="rounded-[var(--radius-md)] border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="tnum text-[13px] font-semibold text-[var(--text-0)]">
                            {formatDateOnly(pause.fromDate)} — {formatDateOnly(pause.toDate)}
                          </p>
                          <p className="mt-1 text-[12px] text-[var(--text-2)]">
                            {pause.reason || 'بدون سبب مكتوب'}
                          </p>
                        </div>
                        {canWrite && <DeletePauseButton pauseId={pause.id} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
