import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Droplets,
  Receipt,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { withFrom } from '@/lib/back-link';
import { JOB_STATUS } from '@/lib/labels';
import { formatBookingTime, formatDate, formatKWD } from '@/lib/utils';
import type { AttentionItem } from './attention';
import {
  BOOKING_EVENT_SELECT,
  JOB_EVENT_SELECT,
  ORDER_EVENT_SELECT,
  VEHICLE_WARRANTY_SELECT,
  bookingEvent,
  customerHref,
  invoiceEvent,
  jobEvent,
  monthName,
  mostUrgentFirst,
  newestFirst,
  warrantyRows,
  type ProfilePerms,
} from './profile-data';
import { EventList, IconTile, Panel, PanelLink, Plate } from './profile-parts';
import { RecordServiceButton } from './service-form';
import { VehicleFormButton } from './vehicle-form';

/** ما يُرى دون نقرة؛ الباقي تحت «عرض N أخرى» كي لا تغرق الصفحة في يوم مزدحم */
const VISIBLE_ATTENTION = 4;

export async function OverviewTab({
  customerId,
  here,
  from,
  attention,
  perms,
  now,
}: {
  customerId: string;
  here: string;
  from?: string;
  attention: AttentionItem[];
  perms: ProfilePerms;
  now: Date;
}) {
  const [jobs, bookings, orders, vehicles, washing] = await Promise.all([
    perms.workshop
      ? db.jobOrder.findMany({
          where: { customerId },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: JOB_EVENT_SELECT,
        })
      : [],
    // الحجز القادم ليس نشاطاً وقع — مكانه «القادم» في قسم الشغل والحجوزات
    db.booking.findMany({
      where: { customerId, scheduledAt: { lte: now } },
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: BOOKING_EVENT_SELECT,
    }),
    perms.invoices
      ? db.order.findMany({
          where: { customerId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: ORDER_EVENT_SELECT,
        })
      : [],
    db.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        make: true,
        model: true,
        plateNo: true,
        services: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
        warranties: { where: { customerId, isVoid: false }, select: VEHICLE_WARRANTY_SELECT },
      },
    }),
    perms.wash
      ? db.washSubscription.findMany({
          where: { customerId, status: { not: 'ENDED' } },
          select: { vehicleId: true },
        })
      : [],
  ]);

  const recent = [
    ...jobs.map((job) => jobEvent(job, here)),
    ...bookings.map((booking) => bookingEvent(booking, here, customerId, perms.workshop)),
    ...orders.map((order) => invoiceEvent(order, here)),
  ]
    .sort(newestFirst)
    .slice(0, 5);

  const washed = new Set(washing.map((subscription) => subscription.vehicleId));
  const cars = vehicles
    .map((vehicle) => ({
      id: vehicle.id,
      vehicle,
      rows: warrantyRows(vehicle.warranties, vehicle.services[0]?.visitedAt ?? null, now),
    }))
    .sort(mostUrgentFirst);

  const rows = attention.map((item) => attentionRow(item, { customerId, here, perms }));
  const shown = rows.slice(0, VISIBLE_ATTENTION);
  const hidden = rows.slice(VISIBLE_ATTENTION);

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <Panel
          title="يحتاج انتباه"
          icon={CircleAlert}
          iconClassName="text-danger"
          count={rows.length}
        >
          <div className="divide-y divide-[var(--line)]">
            {shown.map((row) => (
              <AttentionLine key={row.id} {...row} />
            ))}
          </div>
          {hidden.length > 0 && (
            <details className="group border-t border-[var(--line)]">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-center text-[12px] font-medium text-accent marker:content-none sm:px-5">
                <span className="group-open:hidden">عرض {hidden.length} أخرى</span>
                <span className="hidden group-open:inline">إخفاء</span>
              </summary>
              <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {hidden.map((row) => (
                  <AttentionLine key={row.id} {...row} />
                ))}
              </div>
            </details>
          )}
        </Panel>
      ) : (
        <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3.5 text-[13px] text-[var(--text-1)] sm:px-5">
          <CircleCheck className="size-4 shrink-0 text-ok" />
          لا شيء معلّق على هذا العميل الآن.
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="آخر نشاط"
          action={
            recent.length > 0 ? (
              /* النشاط يخلط الشغل بالفواتير، ولكلٍّ قسمه — فلا رابط واحد يدّعي «الكل» */
              <div className="flex items-center gap-3">
                <PanelLink href={customerHref(customerId, { tab: 'work', from })}>
                  {perms.workshop ? 'الشغل والحجوزات' : 'الحجوزات'}
                </PanelLink>
                {perms.invoices && (
                  <PanelLink href={customerHref(customerId, { tab: 'invoices', from })}>الفواتير</PanelLink>
                )}
              </div>
            ) : null
          }
        >
          {recent.length > 0 ? (
            <EventList events={recent} />
          ) : (
            <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لا نشاط مسجّل بعد.</p>
          )}
        </Panel>

        <Panel
          title="السيارات"
          count={vehicles.length}
          action={
            vehicles.length > 0 ? (
              <PanelLink href={customerHref(customerId, { tab: 'cars', from })}>التفاصيل</PanelLink>
            ) : perms.write ? (
              <VehicleFormButton customerId={customerId} />
            ) : null
          }
        >
          {cars.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لا توجد سيارة مسجّلة.</p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {cars.map(({ vehicle, rows: [worst] }) => (
                <div key={vehicle.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--text-0)]">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <Plate value={vehicle.plateNo} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {worst ? (
                      <Badge tone={worst.badge.tone}>{worst.badge.label}</Badge>
                    ) : (
                      <Badge tone="neutral">بلا كفالة</Badge>
                    )}
                    {washed.has(vehicle.id) && <Badge tone="info">اشتراك غسيل</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

interface AttentionRowView {
  id: string;
  icon: LucideIcon;
  tile: string;
  title: string;
  detail: string;
  action: React.ReactNode;
}

function attentionRow(
  item: AttentionItem,
  { customerId, here, perms }: { customerId: string; here: string; perms: ProfilePerms }
): AttentionRowView {
  const secondary = buttonVariants({ variant: 'secondary', size: 'sm' });

  switch (item.kind) {
    case 'job':
      return {
        id: `job-${item.id}`,
        icon: Wrench,
        tile: 'bg-accent/12 text-accent',
        title: `أمر شغل ${item.number} — ${JOB_STATUS[item.status].label}`,
        detail: [item.vehicle ?? 'بدون سيارة', `استُلم ${formatDate(item.receivedAt)}`].join(' · '),
        action: (
          <Link href={withFrom(`/dashboard/job-orders/${item.id}`, here)} className={secondary}>
            فتح الأمر
          </Link>
        ),
      };
    case 'booking': {
      const time = formatBookingTime(item.scheduledAt);
      return {
        id: `booking-${item.id}`,
        icon: CalendarDays,
        tile: 'bg-warn/12 text-warn',
        title: time ? `موعد اليوم ${time}` : 'موعد اليوم',
        detail: [item.code, item.detail].filter(Boolean).join(' · '),
        action: (
          <Link
            href={withFrom(`/dashboard/bookings?view=list&customer=${customerId}`, here)}
            className={secondary}
          >
            فتح الحجز
          </Link>
        ),
      };
    }
    case 'service':
      return {
        id: `service-${item.vehicleId}`,
        icon: ShieldCheck,
        tile: item.tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-warn/12 text-warn',
        title: `سيرفس الكفالة — ${item.label}`,
        detail: `${item.vehicle} · ${item.warranty}`,
        action: perms.write ? (
          <RecordServiceButton
            vehicleId={item.vehicleId}
            label={`${item.vehicle}${item.plateNo ? ` — ${item.plateNo}` : ''}`}
            labelled
          />
        ) : (
          <Link href={customerHref(customerId, { tab: 'cars' })} className={secondary}>
            السيارات
          </Link>
        ),
      };
    case 'invoice':
      return {
        id: `invoice-${item.id}`,
        icon: Receipt,
        tile: 'bg-danger/12 text-danger',
        title: `فاتورة غير مسدّدة — متبقي ${formatKWD(item.remaining)}`,
        detail: [item.number, item.vehicle, `صدرت ${formatDate(item.createdAt)}`]
          .filter(Boolean)
          .join(' · '),
        action: (
          <Link href={withFrom(`/dashboard/invoices/${item.id}`, here)} className={secondary}>
            فتح الفاتورة
          </Link>
        ),
      };
    case 'wash':
      return {
        id: `wash-${item.subscriptionId}-${item.year}-${item.month}`,
        icon: Droplets,
        tile: 'bg-danger/12 text-danger',
        title: `شهر غسيل غير مدفوع — ${monthName(item.year, item.month)}`,
        detail: `${item.vehicle} · ${formatKWD(item.amount)} · الغسلات متوقفة حتى السداد`,
        action: (
          <Link
            href={withFrom(`/dashboard/wash/billing?year=${item.year}&month=${item.month}`, here)}
            className={secondary}
          >
            تحصيل
          </Link>
        ),
      };
  }
}

function AttentionLine({ icon, tile, title, detail, action }: AttentionRowView) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <IconTile icon={icon} className={tile} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--text-0)]">{title}</p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
