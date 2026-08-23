import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { ADVANCE_STATUS } from '@/lib/labels';
import { formatDate, formatDateOnly, formatKWD, toNumber } from '@/lib/utils';
import { PrintButton } from '@/app/dashboard/invoices/[id]/print-button';
import { DeleteRepaymentButton, RepayButton } from '../advances-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const advance = await db.employeeAdvance.findUnique({
    where: { id },
    select: { employee: { select: { fullName: true } } },
  });
  return { title: advance ? `سلفة ${advance.employee.fullName}` : 'سلفة' };
}

export default async function AdvanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { id } = await params;

  const advance = await db.employeeAdvance.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, fullName: true, code: true, position: true } },
      repayments: {
        orderBy: { paidAt: 'asc' },
        include: { payrollRun: { select: { id: true, month: true, year: true } } },
      },
    },
  });

  if (!advance) notFound();

  const canWrite = can(session.user.role, 'hr:write');
  const total = toNumber(advance.amount);
  const paid = advance.repayments.reduce((s, r) => s + toNumber(r.amount), 0);
  const remaining = Math.round((total - paid) * 1000) / 1000;
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  // رصيد متناقص بعد كل قسط — عمود «المتبقي» في الكشف
  const rows = advance.repayments.map((r, i) => {
    const paidSoFar = advance.repayments
      .slice(0, i + 1)
      .reduce((s, x) => s + toNumber(x.amount), 0);
    return { ...r, balance: Math.round((total - paidSoFar) * 1000) / 1000 };
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/hr/advances"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          العودة إلى السلف
        </Link>
        <div className="flex items-center gap-2">
          {canWrite && advance.status === 'ACTIVE' && remaining > 0 && (
            <RepayButton
              advanceId={advance.id}
              remaining={remaining}
              monthlyDeduction={toNumber(advance.monthlyDeduction)}
            />
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="flex-col items-center gap-1 text-center">
            <CardTitle className="text-lg">كشف حساب سلفة</CardTitle>
            <p className="text-[13px] text-[var(--text-1)]">
              <Link
                href={`/dashboard/hr/employees/${advance.employee.id}`}
                className="font-semibold text-accent hover:underline print:text-[var(--text-0)]"
              >
                {advance.employee.fullName}
              </Link>
              <span className="tnum text-[var(--text-2)]" dir="ltr">
                {' '}
                — {advance.employee.code}
              </span>
            </p>
            {advance.employee.position && (
              <p className="text-[12px] text-[var(--text-2)]">{advance.employee.position}</p>
            )}
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="grid gap-3 text-[13px] sm:grid-cols-4">
              <Stat label="قيمة السلفة" value={formatKWD(total)} />
              <Stat label="المسدّد" value={formatKWD(paid)} tone="ok" />
              <Stat label="المتبقي" value={formatKWD(remaining)} tone="warn" />
              <Stat label="القسط الشهري" value={formatKWD(toNumber(advance.monthlyDeduction))} />
            </div>

            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-ok transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="tnum text-[12px] text-[var(--text-2)]">{percent}%</span>
              <Badge tone={ADVANCE_STATUS[advance.status].tone}>
                {ADVANCE_STATUS[advance.status].label}
              </Badge>
            </div>

            <div className="grid gap-3 border-t border-[var(--line)] pt-4 text-[13px] sm:grid-cols-2">
              <div>
                <p className="text-[11px] text-[var(--text-2)]">تاريخ الصرف</p>
                <p className="tnum text-[var(--text-1)]">{formatDateOnly(advance.grantedAt)}</p>
              </div>
              {advance.reason && (
                <div>
                  <p className="text-[11px] text-[var(--text-2)]">السبب</p>
                  <p className="text-[var(--text-1)]">{advance.reason}</p>
                </div>
              )}
            </div>

            {advance.notes && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="mb-1 text-[11px] font-semibold text-[var(--text-2)]">ملاحظات</p>
                <p className="text-[13px] text-[var(--text-1)]">{advance.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle>سجل السداد — {rows.length} قسط</CardTitle>
          </CardHeader>

          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>تاريخ السداد</Th>
                  <Th>المبلغ</Th>
                  <Th>المتبقي بعده</Th>
                  <Th>المصدر</Th>
                  <Th>ملاحظة</Th>
                  {canWrite && <Th />}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyState
                    title="لم يُسدَّد أي قسط بعد"
                    description="تُسجَّل الأقساط يدوياً أو تلقائياً مع مسيّر الرواتب"
                    colSpan={7}
                  />
                ) : (
                  rows.map((r, i) => (
                    <Tr key={r.id}>
                      <Td className="tnum text-[12px] text-[var(--text-2)]">{i + 1}</Td>
                      <Td className="tnum text-[13px]">{formatDate(r.paidAt)}</Td>
                      <Td className="tnum font-semibold text-ok">
                        {formatKWD(toNumber(r.amount))}
                      </Td>
                      <Td className="tnum text-[13px] text-[var(--text-1)]">
                        {formatKWD(r.balance)}
                      </Td>
                      <Td>
                        {r.payrollRun ? (
                          <Link
                            href={`/dashboard/hr/payroll`}
                            className="text-[12px] text-accent hover:underline print:text-[var(--text-0)]"
                          >
                            <Badge tone="info">
                              مسيّر {r.payrollRun.month}/{r.payrollRun.year}
                            </Badge>
                          </Link>
                        ) : (
                          <Badge tone="neutral">يدوي</Badge>
                        )}
                      </Td>
                      <Td className="max-w-48 truncate text-[12px] text-[var(--text-2)]" title={r.note ?? ''}>
                        {r.note ?? '—'}
                      </Td>
                      {canWrite && (
                        <Td className="print:hidden">
                          {!r.payrollRunId && (
                            <DeleteRepaymentButton
                              id={r.id}
                              label={`${formatKWD(toNumber(r.amount))} — ${formatDate(r.paidAt)}`}
                            />
                          )}
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>

          {rows.length > 0 && (
            <CardBody className="border-t border-[var(--line)]">
              <div className="ms-auto max-w-xs space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-2)]">إجمالي المسدّد</span>
                  <span className="tnum font-bold text-ok">{formatKWD(paid)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
                  <span className="font-bold text-[var(--text-0)]">المتبقي</span>
                  <span className="tnum font-bold text-[var(--text-0)]">
                    {formatKWD(remaining)}
                  </span>
                </div>
              </div>

              <div className="mt-8 hidden grid-cols-2 gap-6 text-center text-[12px] text-[var(--text-2)] print:grid">
                <div>
                  <div className="mb-1 border-b border-dashed border-[var(--line-strong)] pb-8" />
                  توقيع الموظف
                </div>
                <div>
                  <div className="mb-1 border-b border-dashed border-[var(--line-strong)] pb-8" />
                  توقيع المسؤول
                </div>
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-[var(--text-0)]';
  return (
    <div>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p className={`tnum text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}
