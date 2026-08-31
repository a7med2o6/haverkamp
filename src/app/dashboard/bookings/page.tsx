import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { CustomerFilterBar } from '@/components/dashboard/customer-filter';
import { PageHeader } from '@/components/dashboard/page-header';
import { Pagination } from '@/components/dashboard/pagination';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS, CUSTOMER_SOURCE } from '@/lib/labels';
import { PAGE_SIZE } from '@/lib/constants';
import {
  cn,
  formatDateTime,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  toLocalInput,
  weekDays,
} from '@/lib/utils';
import { queueWhere, reminderInclude, tomorrowKey } from '@/lib/reminders';
import { bookingServiceLabel } from '@/lib/intake';
import type { CalendarBooking } from './calendar';
import { MonthView } from './month-view';
import { RemindersView } from './reminders-view';
import { WeekView } from './week-view';
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

const VIEWS = [
  { key: 'month', label: 'الشهر' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'reminders', label: 'التذكيرات' },
  { key: 'list', label: 'القائمة' },
] as const;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    page?: string;
    view?: string;
    week?: string;
    month?: string;
    day?: string;
    q?: string;
    customer?: string;
  }>;
}) {
  const session = await requirePermission('crm:read');
  const {
    filter = 'upcoming',
    page: pageParam,
    view,
    week: weekParam,
    month: monthParam,
    day: dayParam,
    q,
    customer,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // الشهر هو الافتراضي — النظرة الشاملة أولاً، والأسبوع للتفاصيل.
  // التصفية بعميل تُلزم عرض القائمة: تقويم لعميل واحد بلا معنى.
  const mode =
    customer || view === 'list'
      ? 'list'
      : view === 'week'
        ? 'week'
        : view === 'reminders'
          ? 'reminders'
          : 'month';

  // مرساة التقويم — من المَعلمة أو التاريخ الحالي
  const monthAnchor = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const monthStart = startOfMonth(
    Number.isNaN(monthAnchor.getTime()) ? new Date() : monthAnchor
  );
  const monthCells = monthGridDays(monthStart);

  // يوم طابور التذكيرات — الغد افتراضاً
  const reminderDay = /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? '')
    ? dayParam!
    : tomorrowKey();

  const weekAnchor = weekParam ? new Date(`${weekParam}T00:00:00`) : new Date();
  const weekStart = startOfWeek(
    Number.isNaN(weekAnchor.getTime()) ? new Date() : weekAnchor
  );

  // مدى ما يُعرض على الشبكة — يشمل أطراف الشهر من الشهرين المجاورين
  const calStart = mode === 'month' ? monthCells[0] : weekStart;
  const calEnd = new Date(
    mode === 'month' ? monthCells[monthCells.length - 1] : weekDays(weekStart)[6]
  );
  calEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const byFilter: Prisma.BookingWhereInput =
    filter === 'upcoming'
      ? { scheduledAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } }
      : filter === 'today'
        ? { scheduledAt: { gte: todayStart, lt: todayEnd } }
        : filter === 'PENDING'
          ? { status: 'PENDING' }
          : {};

  // بحث القائمة — بكود الحجز أو اسم العميل أو هاتفه، ومنه تُفتح بطاقة التقويم
  const bySearch: Prisma.BookingWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { guestName: { contains: q, mode: 'insensitive' } },
          { guestPhone: { contains: q } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone: { contains: q } } },
        ],
      }
    : {};

  const filters: Prisma.BookingWhereInput[] = [byFilter, bySearch];
  // تصفية بعميل واحد — من رابط «عرض الكل» في ملف العميل
  if (customer) filters.push({ customerId: customer });
  const where: Prisma.BookingWhereInput = { AND: filters };

  const isCalendar = mode === 'month' || mode === 'week';

  const reminders =
    mode === 'reminders'
      ? await db.booking.findMany({
          where: queueWhere(reminderDay),
          orderBy: { scheduledAt: 'asc' },
          include: reminderInclude,
        })
      : [];

  const [calBookings, weekendSetting] = isCalendar
    ? await Promise.all([
        db.booking.findMany({
          where: { scheduledAt: { gte: calStart, lte: calEnd } },
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

  const [bookings, total, customers] = await Promise.all([
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
  ]);

  const canWrite = can(session.user.role, 'crm:write');
  const canWorkshop = can(session.user.role, 'workshop:write');
  const weekend = (weekendSetting?.value as string[] | undefined) ?? ['FRI'];
  const calendar = calBookings.map<CalendarBooking>((b) => ({
    id: b.id,
    code: b.code,
    scheduledAt: b.scheduledAt,
    status: b.status,
    name: b.customer?.name ?? b.guestName ?? 'زائر',
    car: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : (b.guestCar ?? ''),
    service: bookingServiceLabel(b) ?? '',
    hasJob: !!b.jobOrder,
  }));

  return (
    <>
      <PageHeader
        title="الحجوزات"
        description={
          isCalendar
            ? `${calendar.length} حجز في المدى المعروض`
            : mode === 'reminders'
              ? `${reminders.filter((b) => !b.reminderSentAt).length} تذكير بانتظار الإرسال`
              : `${total} حجز`
        }
        actions={
          canWrite ? (
            <BookingFormButton customers={customers} />
          ) : null
        }
      />

      {customer && (
        <CustomerFilterBar
          customerId={customer}
          clearHref="/dashboard/bookings?view=list"
        />
      )}

      {/* تبويبات العرض */}
      <div className="mb-4 flex gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/dashboard/bookings?view=${v.key}`}
            className={cn(
              'rounded-[var(--radius-sm)] border px-4 py-1.5 text-[13px] font-semibold transition-colors',
              v.key === mode
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {mode === 'month' ? (
        <MonthView
          monthStart={monthStart}
          days={monthCells}
          today={new Date()}
          canWrite={canWrite}
          weekend={weekend}
          bookings={calendar}
        />
      ) : mode === 'week' ? (
        <WeekView
          start={weekStart}
          today={new Date()}
          canWrite={canWrite}
          weekend={weekend}
          bookings={calendar}
        />
      ) : mode === 'reminders' ? (
        <RemindersView
          day={reminderDay}
          dayDate={new Date(`${reminderDay}T12:00:00+03:00`)}
          bookings={reminders}
          canWrite={canWrite}
        />
      ) : (
      <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/bookings?view=list&filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
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

      <SearchBar
        placeholder="ابحث بكود الحجز أو اسم العميل أو هاتفه…"
        className="mb-4 max-w-md"
      />

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
                  <Td className="text-[12px]">{bookingServiceLabel(b) ?? '—'}</Td>
                  <Td className="tnum text-[12px]">
                    {formatDateTime(b.scheduledAt)}
                    {b.rescheduledAt && (
                      <span className="block text-[11px] font-semibold text-info">
                        غيّره العميل
                      </span>
                    )}
                  </Td>
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
                          booking={{
                            id: b.id,
                            customerId: b.customerId,
                            vehicleId: b.vehicleId,
                            serviceKey: b.serviceKey,
                            serviceSpec: b.serviceSpec,
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
