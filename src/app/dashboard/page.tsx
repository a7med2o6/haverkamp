import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { cn, expiryStatus, formatDateOnly, formatDateTime, formatKWD, formatPhone, toNumber, todayDateOnly } from '@/lib/utils';
import { BOOKING_STATUS, DOCUMENT_TYPE, JOB_STATUS } from '@/lib/labels';
import {
  PASSPORT_ALERT_DAYS,
  PASSPORT_CRITICAL_DAYS,
  RESIDENCY_ALERT_DAYS,
  RESIDENCY_DOC_TYPES,
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

function dayBounds(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function DashboardHome() {
  const session = await requireAuth();
  const role = session.user.role;
  const { start, end } = dayBounds();
  // عتبة تنبيه الإقامات — تشمل المنتهية بالفعل (بلا حدّ أدنى)
  const residencyDeadline = new Date(
    todayDateOnly().getTime() + RESIDENCY_ALERT_DAYS * 86400000
  );
  // الجواز نافذته سنة: تجديد الإقامة يشترط بقاء سنة فيه
  const passportDeadline = new Date(
    todayDateOnly().getTime() + PASSPORT_ALERT_DAYS * 86400000
  );

  const [
    todaySales,
    todayBookings,
    activeJobs,
    lowStock,
    presentToday,
    pendingLeaves,
    expiringResidencies,
    upcomingBookings,
    recentJobs,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { createdAt: { gte: start, lt: end }, status: { in: ['COMPLETED', 'PARTIAL'] } },
    }),
    db.booking.count({ where: { scheduledAt: { gte: start, lt: end } } }),
    db.jobOrder.count({ where: { status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK'] } } }),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM products
      WHERE "isActive" = true AND "trackStock" = true AND "stockQty" <= "reorderLevel"
    `,
    db.attendance.count({
      where: { date: { gte: start, lt: end }, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
    }),
    db.leaveRequest.count({ where: { status: 'PENDING' } }),
    /*
      وثائق تحتاج تحرّكاً — الأقرب أولاً.
      الجواز داخل هنا بنافذته الخاصة: كان خارج المراقبة كلّها، فجواز
      باقٍ له سبعة أشهر لا يظهر في أي مكان رغم أنه يمنع تجديد الإقامة.
    */
    db.employeeDocument.findMany({
      where: {
        OR: [
          {
            type: { in: [...RESIDENCY_DOC_TYPES] },
            expiryDate: { not: null, lte: residencyDeadline },
          },
          { type: 'PASSPORT', expiryDate: { not: null, lte: passportDeadline } },
        ],
        employee: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        employee: { select: { id: true, fullName: true, code: true, position: true } },
      },
    }),
    db.booking.findMany({
      where: { scheduledAt: { gte: new Date() }, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 6,
      include: {
        customer: { select: { name: true, phone: true } },
        service: { include: { translations: { where: { locale: 'ar' } } } },
      },
    }),
    db.jobOrder.findMany({
      where: { status: { in: ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] } },
      orderBy: { receivedAt: 'desc' },
      take: 6,
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { make: true, model: true, plateNo: true } },
      },
    }),
  ]);

  const lowStockCount = Number(lowStock[0]?.count ?? 0);

  /*
    أشدّ الوثائق حالاً يحدّد لون التنبيه.
    تلوين القسم أحمر دائماً يجعل الأحمر بلا معنى: جواز باقٍ له سبعة أشهر
    يحتاج تحرّكاً لا استنفاراً، وإقامة انتهت أمس تحتاج الاثنين.
  */
  const expiringPassports = expiringResidencies.filter((d) => d.type === 'PASSPORT');
  const expiringPassportCount = expiringPassports.length;
  const expiringResidencyCount = expiringResidencies.length - expiringPassportCount;

  const passportTone = expiringPassports.some(
    (d) =>
      expiryStatus(d.expiryDate, {
        danger: PASSPORT_CRITICAL_DAYS,
        warn: PASSPORT_ALERT_DAYS,
      }).tone === 'danger'
  )
    ? ('danger' as const)
    : ('warn' as const);

  const docsTone = expiringResidencies.some(
    (d) =>
      expiryStatus(
        d.expiryDate,
        d.type === 'PASSPORT'
          ? { danger: PASSPORT_CRITICAL_DAYS, warn: PASSPORT_ALERT_DAYS }
          : undefined
      ).tone === 'danger'
  )
    ? ('danger' as const)
    : ('warn' as const);

  return (
    <>
      <PageHeader
        title={`أهلاً، ${session.user.name?.split(' ')[0] ?? ''}`}
        description="ملخّص اليوم في مركز هافركامب"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can(role, 'pos:read') && (
          <StatCard
            label="مبيعات اليوم"
            value={formatKWD(toNumber(todaySales._sum.total))}
            hint={`${todaySales._count} فاتورة`}
            icon="Wallet"
            tone="ok"
            href="/dashboard/invoices"
          />
        )}
        {can(role, 'crm:read') && (
          <StatCard
            label="حجوزات اليوم"
            value={todayBookings}
            icon="CalendarClock"
            tone="accent"
            href="/dashboard/bookings"
          />
        )}
        {can(role, 'workshop:read') && (
          <StatCard
            label="أوامر شغل جارية"
            value={activeJobs}
            icon="Wrench"
            tone="accent"
            href="/dashboard/job-orders"
          />
        )}
        {can(role, 'inventory:read') && (
          <StatCard
            label="أصناف تحت حد الطلب"
            value={lowStockCount}
            icon="PackageMinus"
            tone={lowStockCount > 0 ? 'warn' : 'neutral'}
            href="/dashboard/products?filter=low"
          />
        )}
        {can(role, 'hr:read') && (
          <>
            <StatCard
              label="الحضور اليوم"
              value={presentToday}
              icon="UserCheck"
              tone="ok"
              href="/dashboard/hr/attendance"
            />
            <StatCard
              label="إجازات بانتظار الموافقة"
              value={pendingLeaves}
              icon="CalendarOff"
              tone={pendingLeaves > 0 ? 'warn' : 'neutral'}
              href="/dashboard/hr/leaves"
            />
            <StatCard
              label={`إقامات تنتهي خلال ${RESIDENCY_ALERT_DAYS} يوم`}
              value={expiringResidencyCount}
              icon="FileWarning"
              tone={expiringResidencyCount > 0 ? 'danger' : 'neutral'}
              href="/dashboard/hr/employees?expiring=1"
            />
            <StatCard
              label="جوازات تحتاج تجديد"
              value={expiringPassportCount}
              icon="BookUser"
              tone={expiringPassportCount > 0 ? passportTone : 'neutral'}
              href="/dashboard/hr/employees?expiring=1"
            />
          </>
        )}
      </div>

      {/* ── تنبيه الإقامات — يظهر فقط عند وجود ما يحتاج إجراء ── */}
      {can(role, 'hr:read') && expiringResidencies.length > 0 && (
        <Card className={cn('mt-6', docsTone === 'danger' ? 'border-danger/35' : 'border-warn/35')}>
          <CardHeader className={docsTone === 'danger' ? 'bg-danger/[0.07]' : 'bg-warn/[0.07]'}>
            <CardTitle
              className={cn(
                'flex items-center gap-2',
                docsTone === 'danger' ? 'text-danger' : 'text-warn'
              )}
            >
              <TriangleAlert className="size-4" />
              وثائق تحتاج تجديد
            </CardTitle>
            <Link
              href="/dashboard/hr/employees?expiring=1"
              className="text-[12px] text-accent hover:underline"
            >
              عرض الموظفين
            </Link>
          </CardHeader>
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th>الوظيفة</Th>
                  <Th>الوثيقة</Th>
                  <Th>تاريخ الانتهاء</Th>
                  <Th>المتبقي</Th>
                </tr>
              </thead>
              <tbody>
                {expiringResidencies.map((doc) => {
                  // الجواز يُقاس بعتباته: سنة تنبيه وستة أشهر خطر
                  const status = expiryStatus(
                    doc.expiryDate,
                    doc.type === 'PASSPORT'
                      ? { danger: PASSPORT_CRITICAL_DAYS, warn: PASSPORT_ALERT_DAYS }
                      : undefined
                  );
                  return (
                    <Tr key={doc.id}>
                      <Td>
                        <Link
                          href={`/dashboard/hr/employees/${doc.employee.id}`}
                          className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                        >
                          {doc.employee.fullName}
                        </Link>
                        <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                          {doc.employee.code}
                        </span>
                      </Td>
                      <Td className="text-[12px]">{doc.employee.position}</Td>
                      <Td>
                        <Badge tone={DOCUMENT_TYPE[doc.type].tone}>
                          {DOCUMENT_TYPE[doc.type].label}
                        </Badge>
                      </Td>
                      <Td className="tnum text-[12px]">{formatDateOnly(doc.expiryDate)}</Td>
                      <Td>
                        <Badge tone={status.tone === 'neutral' ? 'neutral' : status.tone}>
                          {status.label}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {can(role, 'crm:read') && (
          <Card>
            <CardHeader>
              <CardTitle>الحجوزات القادمة</CardTitle>
              <Link href="/dashboard/bookings" className="text-[12px] text-accent hover:underline">
                عرض الكل
              </Link>
            </CardHeader>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>العميل</Th>
                    <Th>الخدمة</Th>
                    <Th>الموعد</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.length === 0 ? (
                    <EmptyState
                      title="لا توجد حجوزات قادمة"
                      description="الحجوزات الواردة من الموقع تظهر هنا"
                      colSpan={4}
                    />
                  ) : (
                    upcomingBookings.map((b) => (
                      <Tr key={b.id}>
                        <Td>
                          <span className="font-medium text-[var(--text-0)]">
                            {b.customer?.name ?? b.guestName ?? '—'}
                          </span>
                          <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                            {formatPhone(b.customer?.phone ?? b.guestPhone)}
                          </span>
                        </Td>
                        <Td>{b.service?.translations[0]?.name ?? '—'}</Td>
                        <Td className="tnum text-[12px]">{formatDateTime(b.scheduledAt)}</Td>
                        <Td>
                          <Badge tone={BOOKING_STATUS[b.status].tone}>
                            {BOOKING_STATUS[b.status].label}
                          </Badge>
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}

        {can(role, 'workshop:read') && (
          <Card>
            <CardHeader>
              <CardTitle>أوامر الشغل الجارية</CardTitle>
              <Link href="/dashboard/job-orders" className="text-[12px] text-accent hover:underline">
                عرض الكل
              </Link>
            </CardHeader>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>الرقم</Th>
                    <Th>العميل</Th>
                    <Th>السيارة</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.length === 0 ? (
                    <EmptyState
                      title="لا توجد أوامر شغل جارية"
                      description="أنشئ أمر شغل من صفحة أوامر الشغل"
                      colSpan={4}
                    />
                  ) : (
                    recentJobs.map((j) => (
                      <Tr key={j.id}>
                        <Td className="tnum" dir="ltr">
                          <Link
                            href={`/dashboard/job-orders/${j.id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {j.number}
                          </Link>
                        </Td>
                        <Td>{j.customer.name}</Td>
                        <Td className="text-[12px]">
                          {j.vehicle ? `${j.vehicle.make} ${j.vehicle.model}` : '—'}
                          {j.vehicle?.plateNo && (
                            <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                              {j.vehicle.plateNo}
                            </span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</Badge>
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </div>

      {can(role, 'pos:write') && (
        <Card className="mt-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-0)]">جاهز لبدء البيع؟</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                افتح نقطة البيع لتسجيل فاتورة جديدة مباشرة
              </p>
            </div>
            <Link
              href="/dashboard/pos"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-semibold text-[var(--accent-ink)] hover:bg-accent-soft"
            >
              فتح نقطة البيع
            </Link>
          </CardBody>
        </Card>
      )}
    </>
  );
}
