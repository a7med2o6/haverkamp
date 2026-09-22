import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, Clock3, Route } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { formatDateOnly, todayDateOnly, toNumber } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { TodayRoute } from './today-route';
import { washLocationLine } from '@/app/dashboard/wash/location';

export const metadata: Metadata = { title: 'جولة اليوم' };
export const dynamic = 'force-dynamic';

export default async function WashTodayPage() {
  const session = await requirePermission('wash:visit');
  const today = todayDateOnly();
  const employee = await db.employee.findUnique({
    where: { userId: session.user.id },
    select: { id: true, fullName: true },
  });

  if (!employee) {
    const canReadWash = can(session.user.role, 'wash:read');
    return (
      <>
        <PageHeader title="جولة اليوم" description={formatDateOnly(today)} />
        <Card className="mx-auto max-w-xl border-warn/40">
          <CardBody className="py-12 text-center">
            <AlertTriangle className="mx-auto size-10 text-warn" />
            <h1 className="mt-4 text-lg font-bold text-[var(--text-0)]">الحساب غير مرتبط بموظف</h1>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[var(--text-2)]">
              {canReadWash
                ? 'اربط هذا الحساب بملف الموظف حتى تظهر الزيارات المسندة إليه وحدها في جولة اليوم.'
                : 'يُرجى التواصل مع مدير الفرع لربط هذا الحساب بملف الموظف لعرض جولة اليوم.'}
            </p>
            {canReadWash && (
              <Link href="/dashboard/wash/coverage" className={`${buttonVariants({ variant: 'secondary' })} mt-5`}>
                عرض تغطية الشهر
              </Link>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  const visits = await db.washVisit.findMany({
    where: {
      assignedEmployeeId: employee.id,
      scheduledDate: today,
      status: { in: ['PLANNED', 'COMPLETED', 'SKIPPED'] },
    },
    orderBy: [
      { period: { subscription: { area: 'asc' } } },
      { period: { subscription: { building: 'asc' } } },
      { createdAt: 'asc' },
    ],
    include: {
      period: {
        select: {
          subscription: {
            select: {
              area: true,
              block: true,
              street: true,
              building: true,
              locationNotes: true,
              lat: true,
              lng: true,
              customer: { select: { name: true, phone: true } },
              vehicle: { select: { make: true, model: true, plateNo: true } },
            },
          },
        },
      },
    },
  });
  const done = visits.filter((visit) => visit.status !== 'PLANNED').length;
  const remaining = visits.length - done;

  return (
    <>
      <PageHeader
        title="جولة اليوم"
        description={`${employee.fullName} · ${formatDateOnly(today)}`}
        actions={<Badge tone={remaining === 0 ? 'ok' : 'accent'}><Route className="size-3.5" /> {visits.length} زيارة</Badge>}
      />

      <div className="mx-auto mb-4 grid max-w-2xl grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-2)]"><CheckCircle2 className="size-4 text-ok" /> المسجّل</div>
          <p className="tnum mt-1 text-2xl font-extrabold text-[var(--text-0)]">{done}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-2)]"><Clock3 className="size-4 text-accent" /> المتبقّي</div>
          <p className="tnum mt-1 text-2xl font-extrabold text-[var(--text-0)]">{remaining}</p>
        </div>
      </div>

      <TodayRoute
        visits={visits.map((visit) => {
          const subscription = visit.period.subscription;
          return {
            id: visit.id,
            status: visit.status as 'PLANNED' | 'COMPLETED' | 'SKIPPED',
            skipReason: visit.skipReason,
            customerName: subscription.customer.name,
            phone: subscription.customer.phone,
            car: `${subscription.vehicle.make} ${subscription.vehicle.model}`,
            plateNo: subscription.vehicle.plateNo,
            location: washLocationLine(subscription),
            locationNotes: subscription.locationNotes,
            lat: subscription.lat !== null ? toNumber(subscription.lat) : null,
            lng: subscription.lng !== null ? toNumber(subscription.lng) : null,
          };
        })}
      />
    </>
  );
}
