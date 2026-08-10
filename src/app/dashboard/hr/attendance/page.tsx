import type { Metadata } from 'next';
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

  const employees = await db.employee.findMany({
    where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    orderBy: { code: 'asc' },
    include: {
      department: { select: { nameAr: true } },
      attendance: { where: { date } },
    },
  });

  const canWrite = can(session.user.role, 'hr:write');

  const counts = employees.reduce(
    (acc, e) => {
      const status = e.attendance[0]?.status;
      if (!status) acc.unrecorded++;
      else if (status === 'PRESENT') acc.present++;
      else if (status === 'LATE') acc.late++;
      else if (status === 'ABSENT') acc.absent++;
      else if (status === 'ON_LEAVE') acc.onLeave++;
      return acc;
    },
    { present: 0, late: 0, absent: 0, onLeave: 0, unrecorded: 0 }
  );

  return (
    <>
      <PageHeader
        title="الحضور والانصراف"
        description={isToday ? 'سجل اليوم' : `سجل يوم ${formatDateOnly(date)}`}
        actions={<DatePicker date={dateStr} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="حاضر" value={counts.present} icon="UserCheck" tone="ok" />
        <StatCard label="متأخر" value={counts.late} icon="Clock" tone="warn" />
        <StatCard label="غائب" value={counts.absent} icon="UserX" tone="danger" />
        <StatCard label="إجازة" value={counts.onLeave} icon="Palmtree" tone="accent" />
        <StatCard label="لم يُسجّل" value={counts.unrecorded} icon="CircleDashed" />
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
            {employees.length === 0 ? (
              <EmptyState
                title="لا يوجد موظفون نشطون"
                description="أضف موظفين من صفحة الموظفين أولاً"
                colSpan={9}
              />
            ) : (
              employees.map((e) => {
                const record = e.attendance[0];
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
                      {record ? (
                        <Badge tone={ATTENDANCE_STATUS[record.status].tone}>
                          {ATTENDANCE_STATUS[record.status].label}
                        </Badge>
                      ) : (
                        <Badge>لم يُسجّل</Badge>
                      )}
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
                              status: record?.status ?? 'PRESENT',
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
