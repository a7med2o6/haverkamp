import Link from 'next/link';
import { Droplets, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { withFrom } from '@/lib/back-link';
import { cn, formatDateOnly, formatKWD, todayDateOnly, toNumber } from '@/lib/utils';
import { washLocationLine } from '@/app/dashboard/wash/location';
import { monthName, type ProfilePerms } from './profile-data';
import { EmptyPanel, IconTile, Plate } from './profile-parts';

const SUBSCRIPTION_STATUS = {
  ACTIVE: { label: 'سارٍ', tone: 'ok' },
  PAUSED: { label: 'موقوف', tone: 'warn' },
  ENDED: { label: 'منتهٍ', tone: 'muted' },
} as const;

const PERIOD_STATUS = {
  DUE: { label: 'غير مدفوع', tone: 'danger' },
  ELIGIBLE: { label: 'مدفوع', tone: 'ok' },
  CLOSED: { label: 'مُغلق', tone: 'muted' },
} as const;

/** ستة أشهر تكفي لقراءة عادة السداد؛ الأقدم في صفحة الاشتراك */
const PERIODS_SHOWN = 6;

export async function WashTab({
  customerId,
  here,
  perms,
}: {
  customerId: string;
  here: string;
  perms: ProfilePerms;
}) {
  const subscriptions = await db.washSubscription.findMany({
    where: { customerId },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    select: {
      id: true,
      code: true,
      status: true,
      monthlyPrice: true,
      area: true,
      block: true,
      street: true,
      building: true,
      startDate: true,
      endDate: true,
      vehicle: { select: { make: true, model: true, plateNo: true } },
      servicePackage: {
        select: { translations: { where: { locale: 'ar' }, select: { name: true } } },
      },
      defaultWasher: { select: { fullName: true } },
      periods: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: PERIODS_SHOWN,
        select: { id: true, year: true, month: true, status: true, priceSnapshot: true },
      },
    },
  });

  if (subscriptions.length === 0) {
    return (
      <EmptyPanel
        text="لا اشتراكات غسيل لهذا العميل."
        action={
          perms.washWrite ? (
            <Link href="/dashboard/wash" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <Plus />
              اشتراك جديد
            </Link>
          ) : null
        }
      />
    );
  }

  const today = todayDateOnly();
  const periodIds = subscriptions.flatMap((subscription) => subscription.periods.map((period) => period.id));
  const [visitCounts, nextVisits, duePeriods] = await Promise.all([
    db.washVisit.groupBy({
      by: ['periodId', 'status'],
      where: { periodId: { in: periodIds } },
      _count: { _all: true },
    }),
    Promise.all(
      subscriptions.map((subscription) =>
        subscription.status === 'ACTIVE'
          ? db.washVisit.findFirst({
              where: {
                period: { subscriptionId: subscription.id },
                status: 'PLANNED',
                scheduledDate: { gte: today },
              },
              orderBy: { scheduledDate: 'asc' },
              select: { scheduledDate: true },
            })
          : null
      )
    ),
    // الدَّين يُسأل عنه مستقلاً عن الأشهر الستة المعروضة: شهرٌ سابع غير مسدّد يبقى ديناً
    db.washSubscriptionPeriod.findMany({
      where: { subscriptionId: { in: subscriptions.map((subscription) => subscription.id) }, status: 'DUE' },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      select: { subscriptionId: true, year: true, month: true },
    }),
  ]);

  const firstDue = new Map<string, { year: number; month: number }>();
  for (const period of duePeriods) {
    if (!firstDue.has(period.subscriptionId)) firstDue.set(period.subscriptionId, period);
  }

  const visits = new Map<string, { done: number; total: number }>();
  for (const row of visitCounts) {
    const entry = visits.get(row.periodId) ?? { done: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === 'COMPLETED') entry.done += row._count._all;
    visits.set(row.periodId, entry);
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((subscription, index) => {
        const status = SUBSCRIPTION_STATUS[subscription.status];
        const due = firstDue.get(subscription.id);
        const next = nextVisits[index];
        // الموقوف لا يُعطى موعداً: التاريخ يوهم الموظف أن الغسّيل ذاهب
        const nextLabel =
          subscription.status === 'PAUSED'
            ? 'موقوف — لا غسلات'
            : subscription.status === 'ENDED'
              ? `انتهى ${formatDateOnly(subscription.endDate)}`
              : next
                ? formatDateOnly(next.scheduledDate)
                : due
                  ? 'متوقفة حتى السداد'
                  : 'لا غسلة مجدولة';

        return (
          <section
            key={subscription.id}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
              <IconTile icon={Droplets} className="bg-info/12 text-info" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-[var(--text-0)]">
                    {subscription.vehicle.make} {subscription.vehicle.model}
                  </h3>
                  <Plate value={subscription.vehicle.plateNo} />
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {/* الغسلة المخطّطة لا توجد إلا لشهرٍ مدفوع: إن وُجدت فالغسيل ماضٍ وإن بقي شهرٌ قديم غير مسدّد */}
                  {due && subscription.status === 'ACTIVE' && !next && (
                    <Badge tone="danger">متوقف حتى السداد</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  <span className="tnum" dir="ltr">
                    {subscription.code}
                  </span>{' '}
                  · يوم ويوم · منذ {formatDateOnly(subscription.startDate)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {due && (
                  <Link
                    href={withFrom(`/dashboard/wash/billing?year=${due.year}&month=${due.month}`, here)}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    تحصيل {monthName(due.year, due.month)}
                  </Link>
                )}
                <Link
                  href={withFrom(`/dashboard/wash/${subscription.id}`, here)}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  تفاصيل الاشتراك
                </Link>
              </div>
            </header>

            <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-5">
              <Fact label="الباقة" value={subscription.servicePackage?.translations[0]?.name ?? 'بدون باقة'} />
              <Fact label="الاشتراك الشهري" value={formatKWD(subscription.monthlyPrice)} />
              <Fact label="الموقع" value={washLocationLine(subscription)} />
              <Fact label="الغسّيل" value={subscription.defaultWasher?.fullName ?? 'غير محدّد'} />
              <Fact label="الغسلة القادمة" value={nextLabel} />
            </dl>

            {subscription.periods.length === 0 ? (
              <p className="border-t border-[var(--line)] px-4 py-3 text-[12px] text-[var(--text-2)] sm:px-5">
                لم يُفتح شهر لهذا الاشتراك بعد.
              </p>
            ) : (
              <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {subscription.periods.map((period) => {
                  const count = visits.get(period.id) ?? { done: 0, total: 0 };
                  const periodStatus = PERIOD_STATUS[period.status];
                  const percent = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
                  return (
                    <div
                      key={period.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[140px_110px_minmax(0,1fr)_auto] sm:px-5"
                    >
                      <p className="text-[13px] font-semibold text-[var(--text-0)]">
                        {monthName(period.year, period.month)}
                      </p>
                      <p className="tnum text-[13px] text-[var(--text-1)] max-sm:order-3">
                        {formatKWD(toNumber(period.priceSnapshot))}
                      </p>
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-strong)]">
                            <div
                              className={cn('h-full rounded-full', period.status === 'DUE' ? 'bg-danger' : 'bg-ok')}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="tnum whitespace-nowrap text-[11px] text-[var(--text-2)]">
                            {count.done} / {count.total} غسلة
                          </span>
                        </div>
                        {period.status === 'DUE' && (
                          <p className="mt-1 text-[11px] text-[var(--text-2)]">الغسلات متوقفة حتى السداد</p>
                        )}
                      </div>
                      <Badge tone={periodStatus.tone}>{periodStatus.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--text-2)]">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-[var(--text-0)]">{value}</dd>
    </div>
  );
}
