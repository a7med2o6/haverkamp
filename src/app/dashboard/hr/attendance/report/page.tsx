import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PeriodPicker } from './period-picker';

export const metadata: Metadata = { title: 'تقرير الحضور الشهري' };
export const dynamic = 'force-dynamic';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const DAY_INDEX: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** ساعات ودقائق من إجمالي الدقائق */
function hoursLabel(mins: number) {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  await requirePermission('hr:read');
  const sp = await searchParams;

  const now = new Date();
  const month = Math.min(12, Math.max(1, Number(sp.month) || now.getMonth() + 1));
  const year = Number(sp.year) || now.getFullYear();

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [employees, doubleSetting] = await Promise.all([
    db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        fullName: true,
        position: true,
        attendance: {
          where: { date: { gte: periodStart, lt: periodEnd } },
          select: { date: true, status: true, lateMins: true, overtimeMins: true },
        },
      },
    }),
    db.siteSetting.findUnique({ where: { key: 'hr.doubleDeductionDays' } }),
  ]);

  const doubleDays = new Set(
    (Array.isArray(doubleSetting?.value) ? (doubleSetting.value as string[]) : ['THU', 'SAT'])
      .map((c) => DAY_INDEX[c])
      .filter((n) => n !== undefined)
  );

  const rows = employees.map((e) => {
    let present = 0;
    let absent = 0;
    let chargedAbsence = 0;
    let doubledAbsence = 0;
    let late = 0;
    let lateMins = 0;
    let overtimeMins = 0;
    let onLeave = 0;

    for (const a of e.attendance) {
      switch (a.status) {
        case 'PRESENT':
          present++;
          break;
        case 'LATE':
          present++;
          late++;
          break;
        case 'HALF_DAY':
          present++;
          break;
        case 'ABSENT': {
          absent++;
          const isDouble = doubleDays.has(a.date.getUTCDay());
          chargedAbsence += isDouble ? 2 : 1;
          if (isDouble) doubledAbsence++;
          break;
        }
        case 'ON_LEAVE':
          onLeave++;
          break;
      }
      lateMins += a.lateMins;
      overtimeMins += a.overtimeMins;
    }

    const recorded = e.attendance.length;

    return {
      ...e,
      present,
      absent,
      chargedAbsence,
      doubledAbsence,
      late,
      lateMins,
      overtimeMins,
      onLeave,
      unrecorded: Math.max(0, daysInMonth - recorded),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      absent: acc.absent + r.absent,
      charged: acc.charged + r.chargedAbsence,
      late: acc.late + r.late,
      overtime: acc.overtime + r.overtimeMins,
    }),
    { absent: 0, charged: 0, late: 0, overtime: 0 }
  );

  return (
    <>
      <Link
        href="/dashboard/hr/attendance"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى السجل اليومي
      </Link>

      <PageHeader
        title="تقرير الحضور الشهري"
        description={`${MONTHS[month - 1]} ${year} · ${daysInMonth} يوم`}
        actions={<PeriodPicker month={month} year={year} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="أيام الغياب" value={totals.absent} icon="UserX" tone={totals.absent ? 'danger' : 'neutral'} />
        <StatCard
          label="الأيام المحتسبة للخصم"
          value={totals.charged}
          hint="الخميس والسبت بخصم مضاعف"
          icon="Calculator"
          tone={totals.charged > totals.absent ? 'warn' : 'neutral'}
        />
        <StatCard label="مرات التأخير" value={totals.late} icon="Clock" tone={totals.late ? 'warn' : 'neutral'} />
        <StatCard label="إجمالي الإضافي" value={hoursLabel(totals.overtime)} icon="TrendingUp" tone="ok" />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الموظف</Th>
              <Th>الوظيفة</Th>
              <Th>حضور</Th>
              <Th>غياب</Th>
              <Th>محتسب للخصم</Th>
              <Th>تأخير</Th>
              <Th>دقائق التأخير</Th>
              <Th>إضافي</Th>
              <Th>إجازة</Th>
              <Th>لم يُسجّل</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyState title="لا يوجد موظفون نشطون" colSpan={11} />
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="tnum text-[12px]" dir="ltr">
                    {r.code}
                  </Td>
                  <Td>
                    <Link
                      href={`/dashboard/hr/employees/${r.id}`}
                      className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                    >
                      {r.fullName}
                    </Link>
                  </Td>
                  <Td className="text-[12px]">{r.position}</Td>
                  <Td className="tnum font-semibold text-ok">{r.present || '—'}</Td>
                  <Td className={cn('tnum font-semibold', r.absent ? 'text-danger' : '')}>
                    {r.absent || '—'}
                  </Td>
                  <Td className="tnum">
                    {r.chargedAbsence > 0 ? (
                      <span className={r.doubledAbsence > 0 ? 'font-bold text-warn' : ''}>
                        {r.chargedAbsence}
                        {r.doubledAbsence > 0 && (
                          <Badge tone="warn" className="ms-1.5">
                            {r.doubledAbsence} مضاعف
                          </Badge>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className={cn('tnum', r.late ? 'text-warn' : '')}>{r.late || '—'}</Td>
                  <Td className="tnum text-[12px]">{r.lateMins ? `${r.lateMins}د` : '—'}</Td>
                  <Td className="tnum text-[12px] text-ok">{hoursLabel(r.overtimeMins)}</Td>
                  <Td className="tnum">{r.onLeave || '—'}</Td>
                  <Td className="tnum text-[12px] text-[var(--text-2)]">{r.unrecorded || '—'}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
