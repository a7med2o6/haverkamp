import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DOCUMENT_TYPE } from '@/lib/labels';
import { EXPIRY_ALERT_DAYS } from '@/lib/constants';
import { formatDateOnly, todayDateOnly } from '@/lib/utils';
import { DeleteDocumentButton, DocumentFormButton } from './documents-client';

export const metadata: Metadata = { title: 'المستندات والإقامات' };
export const dynamic = 'force-dynamic';

/** الأيام المتبقية حتى الانتهاء — سالبة إن كان منتهياً */
function daysUntil(date: Date | null) {
  if (!date) return null;
  return Math.round((date.getTime() - todayDateOnly().getTime()) / 86400000);
}

function expiryBadge(days: number | null) {
  if (days === null) return { tone: 'neutral' as const, label: 'بدون تاريخ انتهاء' };
  if (days < 0) return { tone: 'danger' as const, label: `منتهي منذ ${Math.abs(days)} يوم` };
  if (days === 0) return { tone: 'danger' as const, label: 'ينتهي اليوم' };
  if (days <= EXPIRY_ALERT_DAYS) return { tone: 'warn' as const, label: `${days} يوم متبقٍ` };
  return { tone: 'ok' as const, label: `${days} يوم متبقٍ` };
}

export default async function DocumentsPage() {
  const session = await requirePermission('hr:read');
  const canWrite = can(session.user.role, 'hr:write');

  const today = todayDateOnly();
  const alertDate = new Date(today.getTime() + EXPIRY_ALERT_DAYS * 86400000);

  const [documents, employees, expiredCount, expiringCount] = await Promise.all([
    db.employeeDocument.findMany({
      orderBy: [{ expiryDate: 'asc' }],
      include: {
        employee: { select: { code: true, fullName: true, status: true } },
      },
    }),
    db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'] } },
      orderBy: { code: 'asc' },
      select: { id: true, fullName: true, code: true },
    }),
    db.employeeDocument.count({ where: { expiryDate: { lt: today } } }),
    db.employeeDocument.count({ where: { expiryDate: { gte: today, lte: alertDate } } }),
  ]);

  return (
    <>
      <PageHeader
        title="المستندات والإقامات"
        description="متابعة تواريخ انتهاء الإقامات والجوازات والعقود"
        actions={canWrite ? <DocumentFormButton employees={employees} /> : null}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="مستندات منتهية" value={expiredCount} icon="FileX" tone={expiredCount ? 'danger' : 'neutral'} />
        <StatCard
          label={`تنتهي خلال ${EXPIRY_ALERT_DAYS} يوم`}
          value={expiringCount}
          icon="FileWarning"
          tone={expiringCount ? 'warn' : 'neutral'}
        />
        <StatCard label="إجمالي المستندات" value={documents.length} icon="Files" />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الموظف</Th>
              <Th>النوع</Th>
              <Th>الرقم</Th>
              <Th>الإصدار</Th>
              <Th>الانتهاء</Th>
              <Th>الحالة</Th>
              <Th>الملف</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <EmptyState
                title="لا توجد مستندات مسجّلة"
                description="سجّل إقامات وجوازات الموظفين لمتابعة تواريخ انتهائها"
                colSpan={8}
              />
            ) : (
              documents.map((d) => {
                const days = daysUntil(d.expiryDate);
                const badge = expiryBadge(days);
                return (
                  <Tr key={d.id}>
                    <Td>
                      <span className="font-medium text-[var(--text-0)]">
                        {d.employee.fullName}
                      </span>
                      <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                        {d.employee.code}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={DOCUMENT_TYPE[d.type].tone}>{DOCUMENT_TYPE[d.type].label}</Badge>
                    </Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {d.number ?? '—'}
                    </Td>
                    <Td className="tnum text-[12px]">{formatDateOnly(d.issueDate)}</Td>
                    <Td className="tnum text-[12px]">{formatDateOnly(d.expiryDate)}</Td>
                    <Td>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </Td>
                    <Td>
                      {d.fileUrl ? (
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-accent hover:underline"
                        >
                          فتح
                        </a>
                      ) : (
                        '—'
                      )}
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center gap-0.5">
                          <DocumentFormButton
                            employees={employees}
                            document={{
                              id: d.id,
                              employeeId: d.employeeId,
                              type: d.type,
                              number: d.number,
                              issueDate: d.issueDate?.toISOString().slice(0, 10) ?? '',
                              expiryDate: d.expiryDate?.toISOString().slice(0, 10) ?? '',
                              fileUrl: d.fileUrl,
                              notes: d.notes,
                            }}
                          />
                          {can(session.user.role, 'hr:delete') && (
                            <DeleteDocumentButton id={d.id} />
                          )}
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
