import type { Metadata } from 'next';
import Link from 'next/link';
import { ChartColumn } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { dateOnlyFromInput, dateOnlyToInput, formatDateOnly, todayDateOnly } from '@/lib/utils';
import { DatePicker, EditAttendanceButton, QuickCheckButtons } from './attendance-client';

export const metadata: Metadata = { title: 'الحضور والانصراف' };
export const dynamic = 'force-dynamic';

/** أرقام getUTCDay: الأحد 0 … السبت 6 — تطابق ما يستعمله المسيّر */
const DAY_INDEX: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

function timeStr(d: Date | null) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { date: dateParam } = await searchParams;

  const date = dateOnlyFromInput(dateParam);
  const dateStr = dateOnlyToInput(date);
  const isToday = date.getTime() === todayDateOnly().getTime();

  const [employees, leaves, weekendSetting] = await Promise.all([
    db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      orderBy: { code: 'asc' },
      include: {
        department: { select: { nameAr: true } },
        attendance: { where: { date } },
      },
    }),
    db.leaveRequest.findMany({
      where: { status: 'APPROVED', fromDate: { lte: date }, toDate: { gte: date } },
      select: { employeeId: true },
    }),
    db.siteSetting.findUnique({ where: { key: 'hr.weekend' } }),
  ]);

  const canWrite = can(session.user.role, 'hr:write');

  const weekendDays = new Set(
    (Array.isArray(weekendSetting?.value) ? (weekendSetting.value as string[]) : ['FRI'])
      .map((code) => DAY_INDEX[code])
      .filter((n) => n !== undefined)
  );
  const isWeekend = weekendDays.has(date.getUTCDay());
  const onLeaveIds = new Set(leaves.map((l) => l.employeeId));

  /**
   * الأصل أن الجميع حاضرون، ولا يُسجَّل إلا الاستثناء.
   * السجل الصريح يعلو دائماً، وما دونه يُستنتج: عطلة أسبوعية، ثم إجازة
   * معتمدة تشمل اليوم، وإلا فحاضر. المسيّر لا يخصم إلا سجلاً صريحاً
   * حالته ABSENT، فالاستنتاج للعرض ولا يمسّ الرواتب.
   */
  const rows = employees.map((e) => {
    const record = e.attendance[0] ?? null;
    if (record) return { employee: e, record, status: record.status, derived: false };

    const status = isWeekend ? 'HOLIDAY' : onLeaveIds.has(e.id) ? 'ON_LEAVE' : 'PRESENT';
    return { employee: e, record: null, status, derived: true } as const;
  });

  const counts = rows.reduce(
    (acc, r) => {
      if (r.status === 'PRESENT') acc.present++;
      else if (r.status === 'LATE') acc.late++;
      else if (r.status === 'ABSENT') acc.absent++;
      else if (r.status === 'ON_LEAVE') acc.onLeave++;
      else if (r.status === 'HOLIDAY') acc.holiday++;
      return acc;
    },
    { present: 0, late: 0, absent: 0, onLeave: 0, holiday: 0 }
  );

  return (
    <>
      <PageHeader
        title="الحضور والانصراف"
        description={`${isToday ? 'سجل اليوم' : `سجل يوم ${formatDateOnly(date)}`} — الجميع حاضرون ما لم تسجّل خلاف ذلك`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/hr/attendance/report?month=${date.getUTCMonth() + 1}&year=${date.getUTCFullYear()}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] px-3.5 text-[13px] font-medium text-[var(--text-1)] hover:border-accent hover:text-accent"
            >
              <ChartColumn className="size-4" />
              التقرير الشهري
            </Link>
            <DatePicker date={dateStr} />
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="حاضر" value={counts.present} icon="UserCheck" tone="ok" />
        <StatCard label="متأخر" value={counts.late} icon="Clock" tone="warn" />
        <StatCard label="غائب" value={counts.absent} icon="UserX" tone="danger" />
        <StatCard label="إجازة" value={counts.onLeave} icon="Palmtree" tone="accent" />
        <StatCard label="عطلة" value={counts.holiday} icon="CircleDashed" />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>الموظف</Th>
              <Th>القسم</Th>
              <Th>الحضور</Th>
              <Th>الانصراف</Th>
              <Th>التأخير</Th>
              <Th>إضافي</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyState
                title="لا يوجد موظفون نشطون"
                description="أضف موظفين من صفحة الموظفين أولاً"
                colSpan={9}
              />
            ) : (
              rows.map(({ employee: e, record, status, derived }) => {
                return (
                  <Tr key={e.id}>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {e.code}
                    </Td>
                    <Td className="font-medium text-[var(--text-0)]">{e.fullName}</Td>
                    <Td className="text-[12px]">{e.department?.nameAr ?? '—'}</Td>
                    <Td className="tnum" dir="ltr">
                      {timeStr(record?.checkIn ?? null) || '—'}
                    </Td>
                    <Td className="tnum" dir="ltr">
                      {timeStr(record?.checkOut ?? null) || '—'}
                    </Td>
                    <Td className="tnum">
                      {record?.lateMins ? (
                        <span className="text-warn">{record.lateMins} د</span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tnum">
                      {record?.overtimeMins ? (
                        <span className="text-ok">{record.overtimeMins} د</span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={ATTENDANCE_STATUS[status].tone}>
                          {ATTENDANCE_STATUS[status].label}
                        </Badge>
                        {derived && (
                          <span className="text-[10px] text-[var(--text-2)]">افتراضي</span>
                        )}
                      </span>
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center gap-1">
                          <QuickCheckButtons
                            employeeId={e.id}
                            hasCheckIn={!!record?.checkIn}
                            hasCheckOut={!!record?.checkOut}
                            isToday={isToday}
                          />
                          <EditAttendanceButton
                            employeeId={e.id}
                            employeeName={e.fullName}
                            date={dateStr}
                            initial={{
                              checkIn: timeStr(record?.checkIn ?? null),
                              checkOut: timeStr(record?.checkOut ?? null),
                              status: record?.status ?? status,
                              notes: record?.notes ?? '',
                            }}
                          />
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
