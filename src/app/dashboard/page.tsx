import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { formatKWD, formatDateTime, toNumber } from '@/lib/utils';
import { BOOKING_STATUS, JOB_STATUS } from '@/lib/labels';

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
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const [
    todaySales,
    todayBookings,
    activeJobs,
    lowStock,
    presentToday,
    pendingLeaves,
    expiringDocs,
    expiringWarranties,
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
    db.employeeDocument.count({
      where: { expiryDate: { not: null, lte: in30Days, gte: new Date() } },
    }),
    db.warranty.count({
      where: { isVoid: false, endDate: { lte: in30Days, gte: new Date() } },
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
              label="مستندات تنتهي خلال ٣٠ يوم"
              value={expiringDocs}
              icon="FileWarning"
              tone={expiringDocs > 0 ? 'danger' : 'neutral'}
              href="/dashboard/hr/documents"
            />
          </>
        )}
        {can(role, 'crm:read') && (
          <StatCard
            label="كفالات تنتهي قريباً"
            value={expiringWarranties}
            icon="ShieldAlert"
            tone={expiringWarranties > 0 ? 'warn' : 'neutral'}
            href="/dashboard/warranties"
          />
        )}
      </div>

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
                            {b.customer?.phone ?? b.guestPhone ?? ''}
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
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-semibold text-[#04121f] hover:bg-accent-soft"
            >
              فتح نقطة البيع
            </Link>
          </CardBody>
        </Card>
      )}
    </>
  );
}
