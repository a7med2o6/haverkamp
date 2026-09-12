import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
} from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import {
  BOOKING_STATUS,
  CUSTOMER_NOTE_TYPE,
  CUSTOMER_SOURCE,
  JOB_STATUS,
  ORDER_STATUS,
} from '@/lib/labels';
import { bookingServiceLabel, serviceStatus, warrantyLabel } from '@/lib/intake';
import { backTo, withFrom } from '@/lib/back-link';
import { kuwaitDayRange } from '@/lib/reminders';
import {
  cn,
  dayKey,
  expiryStatus,
  formatDate,
  formatDateTime,
  formatKWD,
  formatPhone,
  toNumber,
} from '@/lib/utils';
import { CustomerFormButton } from '../customer-form';
import { DeleteVehicleButton, VehicleFormButton } from './vehicle-form';
import { RecordServiceButton } from './service-form';
import { AddNoteButton, DeleteNoteButton, FollowUpToggle } from './notes-client';

/** ترتيب الإلحاح — لاختيار أسوأ حال بين كفالات السيارة */
const TONE_RANK = { neutral: 0, ok: 1, warn: 2, danger: 3 } as const;

const TABS = [
  { key: 'summary', label: 'الملخص' },
  { key: 'history', label: 'السجل' },
  { key: 'contact', label: 'التواصل والبيانات' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const CORE_CUSTOMER_SELECT = {
  id: true,
  code: true,
  name: true,
  phone: true,
  altPhone: true,
  email: true,
  civilId: true,
  address: true,
  area: true,
  notes: true,
  source: true,
  isBlocked: true,
} satisfies Prisma.CustomerSelect;

const STATUS_VEHICLES_SELECT = {
  id: true,
  services: {
    orderBy: { visitedAt: 'desc' },
    take: 1,
    select: { visitedAt: true },
  },
  warranties: {
    where: { isVoid: false, serviceEveryMonths: { not: null } },
    select: {
      serviceEveryMonths: true,
      startDate: true,
      endDate: true,
      isVoid: true,
    },
  },
} satisfies Prisma.VehicleSelect;

const BOOKING_ACTIVITY_SELECT = {
  id: true,
  code: true,
  scheduledAt: true,
  status: true,
  serviceKey: true,
  serviceSpec: true,
  vehicle: { select: { make: true, model: true } },
  service: {
    select: {
      translations: { where: { locale: 'ar' }, select: { name: true } },
    },
  },
  jobOrder: { select: { id: true } },
} satisfies Prisma.BookingSelect;

const JOB_ACTIVITY_SELECT = {
  id: true,
  number: true,
  receivedAt: true,
  status: true,
  vehicle: { select: { make: true, model: true } },
} satisfies Prisma.JobOrderSelect;

const ORDER_ACTIVITY_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  status: true,
  total: true,
  items: { take: 1, select: { label: true } },
  jobOrder: {
    select: { vehicle: { select: { make: true, model: true } } },
  },
} satisfies Prisma.OrderSelect;

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: customer?.name ?? 'العميل' };
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string | string[];
    tab?: string | string[];
  }>;
}) {
  const session = await requirePermission('crm:read');
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const from = typeof query.from === 'string' ? query.from : undefined;
  const tabParam = typeof query.tab === 'string' ? query.tab : undefined;

  /*
    المَعلمة من شريط العنوان وتقبل أي نص، فلا تدخل فروع البيانات قبل أن
    تُحصر في المفاتيح الثلاثة؛ وما عداها يعود إلى الملخص بلا أثر في الرابط.
  */
  const tab = TABS.some((item) => item.key === tabParam)
    ? (tabParam as TabKey)
    : 'summary';

  const canWrite = can(session.user.role, 'crm:write');
  const canDelete = can(session.user.role, 'crm:delete');
  const canReadWorkshop = can(session.user.role, 'workshop:read');
  const canReadInvoices = can(session.user.role, 'pos:read');
  const now = new Date();
  const today = kuwaitDayRange(dayKey(now));

  const [loaded, money, jobActivity, todayBookings, openJobs] = await Promise.all([
    loadCustomer(id, tab),
    db.order.aggregate({
      where: { customerId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    db.jobOrder.aggregate({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      _count: true,
      _max: { receivedAt: true },
    }),
    db.booking.count({
      where: {
        customerId: id,
        scheduledAt: { gte: today.start, lte: today.end },
        status: { in: ['PENDING', 'CONFIRMED'] },
        jobOrder: null,
      },
    }),
    db.jobOrder.count({
      where: {
        customerId: id,
        status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK'] },
      },
    }),
  ]);

  if (!loaded.customer) notFound();

  const customer = loaded.customer;
  const back = backTo(from, {
    href: '/dashboard/customers',
    label: 'العودة إلى العملاء',
  });
  const here = `/dashboard/customers/${customer.id}`;
  const invoiced = toNumber(money._sum.total ?? 0);
  const paid = toNumber(money._sum.paidAmount ?? 0);
  const outstanding = Math.round((invoiced - paid) * 1000) / 1000;
  const waNumber = customer.phone.replace(/[^\d]/g, '');
  const serviceDue = customer.vehicles.some((vehicle) => {
    const lastService = vehicle.services[0]?.visitedAt ?? null;
    return vehicle.warranties.some((warranty) => {
      const status = serviceStatus(warranty, lastService, now);
      return status.required && (status.tone === 'warn' || status.tone === 'danger');
    });
  });
  const hasActionState = outstanding > 0 || todayBookings > 0 || openJobs > 0 || serviceDue;

  let tabContent: React.ReactNode;

  if (loaded.tab === 'summary') {
    const summary = loaded.customer;
    const previousOwned = summary.ownerships.filter(
      (ownership, index, all) =>
        all.findIndex((item) => item.vehicleId === ownership.vehicleId) === index
    );
    const lastJob = canReadWorkshop ? summary.jobOrders[0] : undefined;
    const lastBooking = summary.bookings[0];
    const lastInvoice = canReadInvoices ? summary.orders[0] : undefined;
    const hasLatestActivity = Boolean(lastJob || lastBooking || lastInvoice);

    tabContent = (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
        <section aria-labelledby="current-vehicles-heading">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <h2
              id="current-vehicles-heading"
              className="text-sm font-semibold text-[var(--text-0)]"
            >
              السيارات الحالية ({summary.vehicles.length})
            </h2>
            {canWrite && summary.vehicles.length > 0 && (
              <VehicleFormButton customerId={summary.id} />
            )}
          </div>

          <div className="border-t border-[var(--line)]">
            {summary.vehicles.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <p className="text-[13px] text-[var(--text-2)]">لا توجد سيارة مسجّلة</p>
                {canWrite && <VehicleFormButton customerId={summary.id} />}
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {summary.vehicles.map((vehicle) => {
                  const lastService = vehicle.services[0]?.visitedAt ?? null;
                  const states = vehicle.warranties
                    .flatMap((warranty) => {
                      const name = warrantyLabel(warranty);
                      const service = serviceStatus(warranty, lastService, now);
                      const expiry = expiryStatus(warranty.endDate);
                      return [
                        ...(service.required
                          ? [
                              {
                                warrantyId: warranty.id,
                                tone: service.tone,
                                label: `${name} · ${service.label}`,
                              },
                            ]
                          : []),
                        {
                          warrantyId: warranty.id,
                          tone: expiry.tone,
                          label: `${name} · ${expiry.label}`,
                        },
                      ];
                    })
                    .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);
                  const worst = states[0];
                  const hasConditionalWarranty = vehicle.warranties.some(
                    (warranty) => warranty.serviceEveryMonths !== null
                  );

                  return (
                    <div
                      key={vehicle.id}
                      className="flex items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-[var(--text-0)]">
                            {vehicle.make} {vehicle.model}
                          </span>
                          <span
                            className="tnum text-[12px] text-[var(--text-1)]"
                            dir="ltr"
                          >
                            {vehicle.plateNo ?? '—'}
                          </span>
                          {worst ? (
                            <Link href={withFrom(`/dashboard/warranties/${worst.warrantyId}`, here)}>
                              <Badge tone={worst.tone}>{worst.label}</Badge>
                            </Link>
                          ) : (
                            <Badge tone="neutral">بلا كفالة</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--text-2)]">
                          {[vehicle.year, vehicle.color].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>

                      {canWrite && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          {hasConditionalWarranty && (
                            <RecordServiceButton
                              vehicleId={vehicle.id}
                              label={`${vehicle.make} ${vehicle.model}${vehicle.plateNo ? ` — ${vehicle.plateNo}` : ''}`}
                            />
                          )}
                          <VehicleFormButton
                            customerId={summary.id}
                            vehicle={{
                              id: vehicle.id,
                              customerId: summary.id,
                              make: vehicle.make,
                              model: vehicle.model,
                              year: vehicle.year,
                              color: vehicle.color,
                              plateNo: vehicle.plateNo,
                              notes: vehicle.notes,
                            }}
                          />
                          {canDelete && (
                            <DeleteVehicleButton id={vehicle.id} customerId={summary.id} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {hasLatestActivity && (
          <section
            aria-labelledby="latest-activity-heading"
            className="border-t border-[var(--line)]"
          >
            <div className="px-4 py-3 sm:px-5">
              <h2
                id="latest-activity-heading"
                className="text-sm font-semibold text-[var(--text-0)]"
              >
                آخر نشاط
              </h2>
            </div>
            <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {lastJob && (
                <ActivityLine
                  href={withFrom(`/dashboard/job-orders/${lastJob.id}`, here)}
                  type="أمر شغل"
                  number={lastJob.number}
                  detail={vehicleLabel(lastJob.vehicle) ?? 'بدون سيارة'}
                  date={formatDate(lastJob.receivedAt)}
                  status={JOB_STATUS[lastJob.status]}
                />
              )}
              {lastBooking && (
                <ActivityLine
                  href={
                    lastBooking.jobOrder
                      ? withFrom(`/dashboard/job-orders/${lastBooking.jobOrder.id}`, here)
                      : withFrom(
                          `/dashboard/bookings?view=list&customer=${summary.id}`,
                          here
                        )
                  }
                  type="حجز"
                  number={lastBooking.code}
                  detail={
                    activityDetail(
                      vehicleLabel(lastBooking.vehicle),
                      bookingServiceLabel(lastBooking)
                    ) ?? 'بدون خدمة'
                  }
                  date={formatDateTime(lastBooking.scheduledAt)}
                  status={BOOKING_STATUS[lastBooking.status]}
                />
              )}
              {lastInvoice && (
                <ActivityLine
                  href={withFrom(`/dashboard/invoices/${lastInvoice.id}`, here)}
                  type="فاتورة"
                  number={lastInvoice.number}
                  detail={
                    activityDetail(
                      vehicleLabel(lastInvoice.jobOrder?.vehicle),
                      lastInvoice.items[0]?.label ?? null
                    ) ?? 'بدون خدمة'
                  }
                  date={formatDate(lastInvoice.createdAt)}
                  status={ORDER_STATUS[lastInvoice.status]}
                />
              )}
            </div>
          </section>
        )}

        {previousOwned.length > 0 && (
          <details className="group border-t border-[var(--line)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--text-0)] marker:content-none sm:px-5">
              سيارات سابقة ({previousOwned.length})
              <span className="text-[12px] font-normal text-[var(--text-2)] group-open:hidden">
                عرض
              </span>
              <span className="hidden text-[12px] font-normal text-[var(--text-2)] group-open:inline">
                إخفاء
              </span>
            </summary>
            <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {previousOwned.map((ownership) => (
                <div key={ownership.id} className="px-4 py-3 sm:px-5">
                  <p className="text-[13px] text-[var(--text-1)]">
                    {ownership.vehicle.make} {ownership.vehicle.model}
                    {ownership.vehicle.plateNo && (
                      <span
                        className="tnum ms-2 text-[12px] text-[var(--text-2)]"
                        dir="ltr"
                      >
                        {ownership.vehicle.plateNo}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-2)]">
                    حتى {formatDate(ownership.to)} · لدى {ownership.vehicle.customer.name} الآن
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  } else if (loaded.tab === 'history') {
    const history = loaded.customer;
    const events = [
      ...(canReadWorkshop
        ? history.jobOrders.map((job) => ({
            kind: 'job' as const,
            id: job.id,
            number: job.number,
            detail: vehicleLabel(job.vehicle) ?? 'بدون سيارة',
            date: job.receivedAt,
            status: JOB_STATUS[job.status],
            href: withFrom(`/dashboard/job-orders/${job.id}`, here),
          }))
        : []),
      ...history.bookings.map((booking) => ({
        kind: 'booking' as const,
        id: booking.id,
        number: booking.code,
        detail:
          activityDetail(
            vehicleLabel(booking.vehicle),
            bookingServiceLabel(booking)
          ) ?? 'بدون خدمة',
        date: booking.scheduledAt,
        status: BOOKING_STATUS[booking.status],
        href: booking.jobOrder
          ? withFrom(`/dashboard/job-orders/${booking.jobOrder.id}`, here)
          : withFrom(`/dashboard/bookings?view=list&customer=${history.id}`, here),
      })),
      ...(canReadInvoices
        ? history.orders.map((order) => ({
            kind: 'invoice' as const,
            id: order.id,
            number: order.number,
            detail:
              activityDetail(
                vehicleLabel(order.jobOrder?.vehicle),
                order.items[0]?.label ?? null
              ) ?? 'بدون خدمة',
            date: order.createdAt,
            status: ORDER_STATUS[order.status],
            href: withFrom(`/dashboard/invoices/${order.id}`, here),
            amount: toNumber(order.total),
          }))
        : []),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
    const shownJobs = events.filter((event) => event.kind === 'job').length;
    const shownBookings = events.filter((event) => event.kind === 'booking').length;
    const shownInvoices = events.filter((event) => event.kind === 'invoice').length;

    tabContent = events.length > 0 ? (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--text-0)]">السجل الزمني</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {canReadWorkshop && (
              <ShowAll
                href={`/dashboard/job-orders?filter=all&customer=${history.id}`}
                shown={shownJobs}
                total={history._count.jobOrders}
                label="أوامر الشغل"
              />
            )}
            <ShowAll
              href={`/dashboard/bookings?view=list&customer=${history.id}`}
              shown={shownBookings}
              total={history._count.bookings}
              label="الحجوزات"
            />
            {canReadInvoices && (
              <ShowAll
                href={`/dashboard/invoices?customer=${history.id}`}
                shown={shownInvoices}
                total={history._count.orders}
                label="الفواتير"
              />
            )}
          </div>
        </div>

        <div className="overflow-x-auto border-t border-[var(--line)]">
          <Table className="min-w-[820px]">
            <thead>
              <tr>
                <Th>النوع</Th>
                <Th>الرقم</Th>
                <Th>السيارة/الخدمة</Th>
                <Th>التاريخ</Th>
                <Th>الحالة</Th>
                <Th>المبلغ</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <Tr key={`${event.kind}-${event.id}`}>
                  <Td className="whitespace-nowrap text-[12px]">
                    {event.kind === 'job'
                      ? 'أمر شغل'
                      : event.kind === 'booking'
                        ? 'حجز'
                        : 'فاتورة'}
                  </Td>
                  <Td className="tnum whitespace-nowrap" dir="ltr">
                    <Link href={event.href} className="font-medium text-accent hover:underline">
                      {event.number}
                    </Link>
                  </Td>
                  <Td className="text-[12px]">{event.detail}</Td>
                  <Td className="tnum whitespace-nowrap text-[12px]">
                    {event.kind === 'booking'
                      ? formatDateTime(event.date)
                      : formatDate(event.date)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={event.status.tone}>{event.status.label}</Badge>
                  </Td>
                  <Td className="tnum whitespace-nowrap font-medium">
                    {event.kind === 'invoice' ? formatKWD(event.amount) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    ) : (
      <EmptyTab
        text="لا يوجد نشاط مسجّل لهذا العميل بعد."
        action={
          canWrite && !history.isBlocked ? (
            <Link
              href={`/dashboard/job-orders/new?customer=${history.id}`}
              className={buttonVariants({ size: 'sm' })}
            >
              <Plus />
              بيان تشغيل جديد
            </Link>
          ) : null
        }
      />
    );
  } else {
    const contact = loaded.customer;
    const hasReferenceData = Boolean(
      contact.altPhone ||
        contact.email ||
        contact.area ||
        contact.address ||
        contact.civilId ||
        contact.notes
    );
    const hasInteractions = contact.interactions.length > 0;

    tabContent = !hasInteractions && !hasReferenceData ? (
      <EmptyTab
        text="لا يوجد سجل تواصل أو بيانات إضافية بعد."
        action={canWrite ? <AddNoteButton customerId={contact.id} /> : null}
      />
    ) : (
      <div
        className={cn(
          'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]',
          hasReferenceData && (hasInteractions || canWrite) &&
            'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]'
        )}
      >
        {(hasInteractions || canWrite) && (
          <section aria-labelledby="contact-log-heading" className="min-w-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <h2
                id="contact-log-heading"
                className="text-sm font-semibold text-[var(--text-0)]"
              >
                سجل التواصل ({contact.interactions.length})
              </h2>
              {canWrite && <AddNoteButton customerId={contact.id} />}
            </div>

            {hasInteractions && (
              <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {contact.interactions.map((note) => {
                  const overdue = Boolean(
                    note.followUpAt && !note.doneAt && note.followUpAt < now
                  );
                  return (
                    <li key={note.id} className={cn('px-4 py-3 sm:px-5', overdue && 'bg-danger/5')}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={CUSTOMER_NOTE_TYPE[note.type].tone}>
                          {CUSTOMER_NOTE_TYPE[note.type].label}
                        </Badge>
                        <span className="tnum text-[11px] text-[var(--text-2)]">
                          {formatDateTime(note.createdAt)}
                        </span>
                        {note.author && (
                          <span className="text-[11px] text-[var(--text-2)]">
                            — {note.author.name}
                          </span>
                        )}
                        {canWrite && (
                          <span className="ms-auto">
                            <DeleteNoteButton id={note.id} />
                          </span>
                        )}
                      </div>

                      <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
                        {note.body}
                      </p>

                      {note.followUpAt && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                          <span
                            className={cn(
                              'tnum text-[11px]',
                              note.doneAt
                                ? 'text-ok'
                                : overdue
                                  ? 'font-semibold text-danger'
                                  : 'text-warn'
                            )}
                          >
                            {note.doneAt
                              ? `تمّت المتابعة ${formatDate(note.doneAt)}`
                              : `متابعة ${formatDate(note.followUpAt)}${overdue ? ' — فات موعدها' : ''}`}
                          </span>
                          {canWrite && <FollowUpToggle id={note.id} done={Boolean(note.doneAt)} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {hasReferenceData && (
          <aside
            aria-labelledby="reference-data-heading"
            className={cn(
              'p-4 sm:p-5',
              (hasInteractions || canWrite) &&
                'border-t border-[var(--line)] lg:border-s lg:border-t-0'
            )}
          >
            <h2
              id="reference-data-heading"
              className="mb-4 text-sm font-semibold text-[var(--text-0)]"
            >
              بيانات إضافية
            </h2>
            <div className="space-y-3.5">
              {contact.altPhone && (
                <InfoRow icon={<Phone className="size-4" />} label="رقم بديل">
                  <span className="tnum" dir="ltr">
                    {formatPhone(contact.altPhone)}
                  </span>
                </InfoRow>
              )}
              {contact.email && (
                <InfoRow icon={<Mail className="size-4" />} label="البريد">
                  <a
                    href={`mailto:${contact.email}`}
                    className="break-all hover:text-accent"
                    dir="ltr"
                  >
                    {contact.email}
                  </a>
                </InfoRow>
              )}
              {(contact.area || contact.address) && (
                <InfoRow icon={<MapPin className="size-4" />} label="العنوان">
                  {[contact.area, contact.address].filter(Boolean).join(' — ')}
                </InfoRow>
              )}
              {contact.civilId && (
                <InfoRow label="الرقم المدني">
                  <span className="tnum" dir="ltr">
                    {contact.civilId}
                  </span>
                </InfoRow>
              )}
              {contact.notes && <InfoRow label="الملاحظات">{contact.notes}</InfoRow>}
            </div>
          </aside>
        )}
      </div>
    );
  }

  return (
    <>
      <Link
        href={back.href}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        {back.label}
      </Link>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-0)] sm:text-2xl">{customer.name}</h1>
            {/* المصدر في السطر الهادئ تحت — شارةً واسمَ نصٍّ معاً تكرارٌ بلا فائدة */}
            {customer.isBlocked && <Badge tone="danger">محظور</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-2)]">
            <span className="tnum" dir="ltr">
              {customer.code}
            </span>
            <span aria-hidden="true">·</span>
            <a href={`tel:${customer.phone}`} className="tnum hover:text-accent" dir="ltr">
              {formatPhone(customer.phone)}
            </a>
            <span aria-hidden="true">·</span>
            <span>{CUSTOMER_SOURCE[customer.source].label}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && !customer.isBlocked && (
            /* العميل يصل مع الرابط فيُعلَّم في البيان — لا يُعاد اختياره */
            <Link
              href={`/dashboard/job-orders/new?customer=${customer.id}`}
              className={buttonVariants({ size: 'sm' })}
            >
              <Plus />
              بيان تشغيل جديد
            </Link>
          )}
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-sm)] bg-ok/15 px-3.5 text-[13px] font-semibold text-ok hover:bg-ok/25"
          >
            <MessageCircle className="size-4" />
            واتساب
          </a>
          {canWrite && (
            <CustomerFormButton
              variant="secondary"
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                altPhone: customer.altPhone,
                email: customer.email,
                civilId: customer.civilId,
                address: customer.address,
                area: customer.area,
                notes: customer.notes,
                source: customer.source,
              }}
            />
          )}
        </div>
      </header>

      {customer.isBlocked && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-3 text-[13px] text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>هذا العميل محظور — لا يمكن إنشاء بيان تشغيل جديد له.</p>
        </div>
      )}

      <section aria-label="حالة العميل" className="mb-4 space-y-2.5">
        {hasActionState && (
          <div className="flex flex-wrap items-center gap-2">
            {outstanding > 0 && (
              <div className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-danger sm:w-auto sm:min-w-[280px]">
                <span className="text-[13px] font-semibold">
                  مستحق عليه <span className="tnum">{formatKWD(outstanding)}</span>
                </span>
                <Link
                  href={`/dashboard/invoices?customer=${customer.id}`}
                  className="shrink-0 text-[12px] font-semibold underline underline-offset-4"
                >
                  عرض الفواتير
                </Link>
              </div>
            )}
            {todayBookings > 0 && <Badge tone="warn">موعد اليوم</Badge>}
            {openJobs > 0 && <Badge tone="accent">أمر شغل مفتوح</Badge>}
            {serviceDue && <Badge tone="danger">سيرفس كفالة مستحق</Badge>}
          </div>
        )}
        <p className="text-[12px] text-[var(--text-2)]">
          <span className="tnum">{jobActivity._count}</span> زيارة · آخر زيارة{' '}
          <span className="tnum">{formatDate(jobActivity._max.receivedAt)}</span> ·{' '}
          {money._count > 0 ? (
            <>
              <span className="tnum">{money._count}</span> فاتورة بإجمالي{' '}
              <span className="tnum">{formatKWD(invoiced)}</span>
            </>
          ) : (
            'لا فواتير بعد'
          )}
        </p>
      </section>

      <nav aria-label="أقسام ملف العميل" className="mb-3 overflow-x-auto" dir="rtl">
        <div className="flex min-w-max border-b border-[var(--line)]">
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Link
                key={item.key}
                href={tabHref(customer.id, item.key, from)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-0)]'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {tabContent}
    </>
  );
}

async function loadCustomer(id: string, tab: TabKey) {
  if (tab === 'history') {
    const customer = await db.customer.findUnique({
      where: { id },
      select: {
        ...CORE_CUSTOMER_SELECT,
        vehicles: { orderBy: { createdAt: 'desc' }, select: STATUS_VEHICLES_SELECT },
        jobOrders: {
          orderBy: { receivedAt: 'desc' },
          take: 10,
          select: JOB_ACTIVITY_SELECT,
        },
        bookings: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
          select: BOOKING_ACTIVITY_SELECT,
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: ORDER_ACTIVITY_SELECT,
        },
        _count: { select: { jobOrders: true, bookings: true, orders: true } },
      },
    });
    return { tab, customer } as const;
  }

  if (tab === 'contact') {
    const customer = await db.customer.findUnique({
      where: { id },
      select: {
        ...CORE_CUSTOMER_SELECT,
        vehicles: { orderBy: { createdAt: 'desc' }, select: STATUS_VEHICLES_SELECT },
        interactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            body: true,
            followUpAt: true,
            doneAt: true,
            createdAt: true,
            author: { select: { name: true } },
          },
        },
      },
    });
    return { tab, customer } as const;
  }

  const customer = await db.customer.findUnique({
    where: { id },
    select: {
      ...CORE_CUSTOMER_SELECT,
      vehicles: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          color: true,
          plateNo: true,
          notes: true,
          services: {
            orderBy: { visitedAt: 'desc' },
            take: 1,
            select: { visitedAt: true },
          },
          warranties: {
            where: { isVoid: false },
            orderBy: { endDate: 'desc' },
            select: {
              id: true,
              subject: true,
              serviceEveryMonths: true,
              startDate: true,
              endDate: true,
              isVoid: true,
              service: {
                select: {
                  translations: { where: { locale: 'ar' }, select: { name: true } },
                },
              },
            },
          },
        },
      },
      ownerships: {
        where: { to: { not: null } },
        orderBy: { to: 'desc' },
        select: {
          id: true,
          vehicleId: true,
          to: true,
          vehicle: {
            select: {
              make: true,
              model: true,
              plateNo: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
      jobOrders: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
        select: JOB_ACTIVITY_SELECT,
      },
      bookings: {
        orderBy: { scheduledAt: 'desc' },
        take: 1,
        select: BOOKING_ACTIVITY_SELECT,
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: ORDER_ACTIVITY_SELECT,
      },
    },
  });
  return { tab, customer } as const;
}

function tabHref(id: string, tab: TabKey, from?: string) {
  const params = new URLSearchParams();
  if (tab !== 'summary') params.set('tab', tab);
  if (from) params.set('from', from);
  const query = params.toString();
  return `/dashboard/customers/${id}${query ? `?${query}` : ''}`;
}

function vehicleLabel(vehicle: { make: string; model: string } | null | undefined) {
  return vehicle ? `${vehicle.make} ${vehicle.model}` : null;
}

function activityDetail(vehicle: string | null, service: string | null) {
  return [vehicle, service].filter(Boolean).join(' · ') || null;
}

function ActivityLine({
  href,
  type,
  number,
  detail,
  date,
  status,
}: {
  href: string;
  type: string;
  number: string;
  detail: string;
  date: string;
  status: { label: string; tone: NonNullable<React.ComponentProps<typeof Badge>['tone']> };
}) {
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--glass)] sm:px-5"
    >
      <span className="w-16 shrink-0 text-[12px] text-[var(--text-2)]">{type}</span>
      <span className="tnum font-medium text-accent" dir="ltr">
        {number}
      </span>
      <span className="min-w-[140px] flex-1 truncate text-[12px] text-[var(--text-1)]">
        {detail}
      </span>
      <span className="tnum text-[11px] text-[var(--text-2)]">{date}</span>
      <Badge tone={status.tone}>{status.label}</Badge>
    </Link>
  );
}

function EmptyTab({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-5 sm:px-5">
      <p className="text-[13px] text-[var(--text-2)]">{text}</p>
      {action}
    </div>
  );
}

/** الرابط يبقى بعد الصف العاشر كي لا يبدو السجل كاملاً وهو مختصر */
function ShowAll({
  href,
  shown,
  total,
  label,
}: {
  href: string;
  shown: number;
  total: number;
  label: string;
}) {
  if (total <= shown) return null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
    >
      كل {label}
      <span className="tnum text-[var(--text-2)]">({total})</span>
      <ArrowLeft className="size-3.5" />
    </Link>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-[var(--text-2)]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--text-2)]">{label}</p>
        <div className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
          {children}
        </div>
      </div>
    </div>
  );
}
