import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS, CUSTOMER_SOURCE } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, formatDateTime, startOfWeek, toLocalInput, weekDays } from '@/lib/utils';
import { WeekView, type WeekBooking } from './week-view';
import {
  BookingFormButton,
  BookingStatusSelect,
  ConvertToJobButton,
} from './bookings-client';

export const metadata: Metadata = { title: 'الحجوزات' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'upcoming', label: 'القادمة' },
  { key: 'PENDING', label: 'بانتظار التأكيد' },
  { key: 'today', label: 'اليوم' },
  { key: 'all', label: 'الكل' },
] as const;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; view?: string; week?: string }>;
}) {
  const session = await requirePermission('crm:read');
  const {
    filter = 'upcoming',
    page: pageParam,
    view = 'week',
    week: weekParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const isWeek = view === 'week';

  // أسبوع التقويم — من المَعلمة أو الأسبوع الحالي
  const anchor = weekParam ? new Date(`${weekParam}T00:00:00`) : new Date();
  const weekStart = startOfWeek(Number.isNaN(anchor.getTime()) ? new Date() : anchor);
  const weekEnd = new Date(weekDays(weekStart)[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const where: Prisma.BookingWhereInput =
    filter === 'upcoming'
      ? { scheduledAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } }
      : filter === 'today'
        ? { scheduledAt: { gte: todayStart, lt: todayEnd } }
        : filter === 'PENDING'
          ? { status: 'PENDING' }
          : {};

  const [weekBookings, weekendSetting] = isWeek
    ? await Promise.all([
        db.booking.findMany({
          where: { scheduledAt: { gte: weekStart, lte: weekEnd } },
          orderBy: { scheduledAt: 'asc' },
          include: {
            customer: { select: { name: true } },
            vehicle: { select: { make: true, model: true } },
            service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
            jobOrder: { select: { id: true } },
          },
        }),
        db.siteSetting.findUnique({ where: { key: 'hr.weekend' } }),
      ])
    : [[], null];

  const [bookings, total, customers, services] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { scheduledAt: filter === 'all' ? 'desc' : 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { make: true, model: true, plateNo: true } },
        service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
        jobOrder: { select: { id: true, number: true } },
      },
    }),
    db.booking.count({ where }),
    db.customer.findMany({
      where: { isBlocked: false },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, phone: true },
    }),
    db.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
    }),
  ]);

  const canWrite = can(session.user.role, 'crm:write');
  const canWorkshop = can(session.user.role, 'workshop:write');
  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: s.translations[0]?.name ?? s.slug,
  }));

  return (
    <>
      <PageHeader
        title="الحجوزات"
        description={`${total} حجز`}
        actions={
          canWrite ? (
            <BookingFormButton customers={customers} services={serviceOptions} />
          ) : null
        }
      />

      {/* تبويبا العرض */}
      <div className="mb-4 flex gap-1.5">
        {[
          { key: 'week', label: 'التقويم' },
          { key: 'list', label: 'القائمة' },
        ].map((v) => (
          <Link
            key={v.key}
            href={v.key === 'week' ? '/dashboard/bookings?view=week' : '/dashboard/bookings?view=list'}
            className={cn(
              'rounded-[var(--radius-sm)] border px-4 py-1.5 text-[13px] font-semibold transition-colors',
              (v.key === 'week') === isWeek
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {isWeek ? (
        <WeekView
          start={weekStart}
          today={new Date()}
          canWrite={canWrite}
          weekend={(weekendSetting?.value as string[] | undefined) ?? ['FRI']}
          bookings={weekBookings.map<WeekBooking>((b) => ({
            id: b.id,
            code: b.code,
            scheduledAt: b.scheduledAt,
            status: b.status,
            name: b.customer?.name ?? b.guestName ?? 'زائر',
            car: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : (b.guestCar ?? ''),
            service: b.service?.translations[0]?.name ?? '',
            hasJob: !!b.jobOrder,
          }))}
        />
      ) : (
      <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/bookings?view=list&filter=${f.key}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filter === f.key
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>العميل</Th>
              <Th>السيارة</Th>
              <Th>الخدمة</Th>
              <Th>الموعد</Th>
              <Th>المصدر</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <EmptyState
                title="لا توجد حجوزات"
                description="الحجوزات الواردة من نموذج الموقع تظهر هنا تلقائياً"
                colSpan={8}
              />
            ) : (
              bookings.map((b) => (
                <Tr key={b.id}>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {b.code}
                  </Td>
                  <Td>
                    {b.customer ? (
                      <Link
                        href={`/dashboard/customers/${b.customer.id}`}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {b.customer.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--text-0)]">
                        {b.guestName ?? '—'}
                      </span>
                    )}
                    <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                      {b.customer?.phone ?? b.guestPhone ?? ''}
                    </span>
                  </Td>
                  <Td className="text-[12px]">
                    {b.vehicle
                      ? `${b.vehicle.make} ${b.vehicle.model}`
                      : (b.guestCar ?? '—')}
                  </Td>
                  <Td className="text-[12px]">{b.service?.translations[0]?.name ?? '—'}</Td>
                  <Td className="tnum text-[12px]">{formatDateTime(b.scheduledAt)}</Td>
                  <Td>
                    <Badge tone={CUSTOMER_SOURCE[b.source].tone}>
                      {CUSTOMER_SOURCE[b.source].label}
                    </Badge>
                  </Td>
                  <Td>
                    {canWrite ? (
                      <BookingStatusSelect id={b.id} status={b.status} />
                    ) : (
                      <Badge tone={BOOKING_STATUS[b.status].tone}>
                        {BOOKING_STATUS[b.status].label}
                      </Badge>
                    )}
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center gap-1">
                        {b.jobOrder ? (
                          <Link
                            href={`/dashboard/job-orders/${b.jobOrder.id}`}
                            className="tnum text-[12px] text-accent hover:underline"
                            dir="ltr"
                          >
                            {b.jobOrder.number}
                          </Link>
                        ) : (
                          canWorkshop &&
                          b.status !== 'CANCELLED' && <ConvertToJobButton id={b.id} />
                        )}
                        <BookingFormButton
                          customers={customers}
                          services={serviceOptions}
                          booking={{
                            id: b.id,
                            customerId: b.customerId,
                            vehicleId: b.vehicleId,
                            serviceId: b.serviceId,
                            guestName: b.guestName,
                            guestPhone: b.guestPhone,
                            guestCar: b.guestCar,
                            scheduledAt: toLocalInput(b.scheduledAt),
                            notes: b.notes,
                            status: b.status,
                          }}
                        />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
      </>
      )}
    </>
  );
}
