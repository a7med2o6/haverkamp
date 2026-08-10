import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PAYROLL_STATUS } from '@/lib/labels';
import { cn, formatDateOnly, formatKWD, toNumber } from '@/lib/utils';
import { AddItemButton, DeleteItemButton, PrintPayslipButton } from './payslip-client';

export const dynamic = 'force-dynamic';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const payslip = await db.payslip.findUnique({
    where: { id },
    include: { employee: { select: { fullName: true } } },
  });
  return { title: payslip ? `قسيمة راتب — ${payslip.employee.fullName}` : 'قسيمة راتب' };
}

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { id } = await params;

  const [payslip, settings] = await Promise.all([
    db.payslip.findUnique({
      where: { id },
      include: {
        items: { orderBy: [{ type: 'asc' }, { isManual: 'asc' }] },
        payrollRun: true,
        employee: {
          include: { department: { select: { nameAr: true } } },
        },
      },
    }),
    db.siteSetting.findMany({
      where: { key: { in: ['site.name.ar', 'contact.address.ar'] } },
    }),
  ]);

  if (!payslip) notFound();

  const setting = (key: string) =>
    (settings.find((s) => s.key === key)?.value as string | undefined) ?? '';

  const canWrite = can(session.user.role, 'hr:write');
  const isDraft = payslip.payrollRun.status === 'DRAFT';

  const earnings = payslip.items.filter((i) => i.type === 'EARNING');
  const deductions = payslip.items.filter((i) => i.type === 'DEDUCTION');
  const totalEarnings = earnings.reduce((s, i) => s + toNumber(i.amount), 0);
  const totalDeductions = deductions.reduce((s, i) => s + toNumber(i.amount), 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/dashboard/hr/payroll/${payslip.payrollRunId}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          العودة إلى المسيّر
        </Link>
        <div className="flex items-center gap-2">
          {canWrite && isDraft && <AddItemButton payslipId={payslip.id} />}
          <PrintPayslipButton />
        </div>
      </div>

      {canWrite && !isDraft && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn print:hidden">
          المسيّر {PAYROLL_STATUS[payslip.payrollRun.status].label} — أعِده إلى مسودة لتعديل البنود.
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="flex-col items-center gap-1 text-center">
            <CardTitle className="text-lg">{setting('site.name.ar') || 'هافركامب الكويت'}</CardTitle>
            <p className="text-[12px] text-[var(--text-2)]">{setting('contact.address.ar')}</p>
            <p className="mt-2 text-[13px] font-bold text-[var(--text-0)]">
              قسيمة راتب — {MONTHS[payslip.payrollRun.month - 1]}{' '}
              <span className="tnum">{payslip.payrollRun.year}</span>
            </p>
          </CardHeader>

          <CardBody className="space-y-5">
            {/* بيانات الموظف */}
            <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] sm:grid-cols-4">
              <Info label="الموظف" value={payslip.employee.fullName} />
              <Info label="الكود" value={payslip.employee.code} ltr />
              <Info label="الوظيفة" value={payslip.employee.position} />
              <Info label="القسم" value={payslip.employee.department?.nameAr ?? '—'} />
              <Info label="تاريخ التعيين" value={formatDateOnly(payslip.employee.hireDate)} ltr />
              <Info label="أيام الغياب" value={String(payslip.absentDays)} ltr />
              <Info label="الحالة" value={PAYROLL_STATUS[payslip.payrollRun.status].label} />
              <Info label="الآيبان" value={payslip.employee.bankIban ?? '—'} ltr small />
            </div>

            {/* الاستحقاقات والخصومات */}
            <div className="grid gap-4 sm:grid-cols-2">
              <ItemsColumn
                title="الاستحقاقات"
                tone="ok"
                items={earnings}
                total={totalEarnings}
                canDelete={canWrite && isDraft}
              />
              <ItemsColumn
                title="الخصومات"
                tone="danger"
                items={deductions}
                total={totalDeductions}
                canDelete={canWrite && isDraft}
              />
            </div>

            {/* الصافي */}
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-accent/35 bg-accent/[0.08] px-5 py-4">
              <span className="text-[15px] font-bold text-[var(--text-0)]">صافي الراتب</span>
              <span className="tnum text-2xl font-bold text-accent">
                {formatKWD(toNumber(payslip.netPay))}
              </span>
            </div>

            {/* التوقيعات */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-center text-[12px] text-[var(--text-2)]">
              <div>
                <div className="mb-1.5 border-t border-[var(--line-strong)] pt-2">توقيع الموظف</div>
              </div>
              <div>
                <div className="mb-1.5 border-t border-[var(--line-strong)] pt-2">
                  توقيع المسؤول
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Info({
  label,
  value,
  ltr,
  small,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  small?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p
        className={cn(
          'font-semibold text-[var(--text-0)]',
          ltr && 'tnum',
          small ? 'break-all text-[11px]' : 'text-[13px]'
        )}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function ItemsColumn({
  title,
  tone,
  items,
  total,
  canDelete,
}: {
  title: string;
  tone: 'ok' | 'danger';
  items: Array<{ id: string; label: string; amount: unknown; isManual: boolean }>;
  total: number;
  canDelete: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)]">
      <div
        className={cn(
          'border-b border-[var(--line)] px-4 py-2.5 text-[13px] font-bold',
          tone === 'ok' ? 'bg-ok/[0.08] text-ok' : 'bg-danger/[0.08] text-danger'
        )}
      >
        {title}
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {items.length === 0 ? (
          <li className="px-4 py-3 text-[12px] text-[var(--text-2)]">لا توجد بنود</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[12px] text-[var(--text-1)]" title={item.label}>
                  {item.label}
                </span>
                {item.isManual && (
                  <Badge tone="accent" className="shrink-0 print:hidden">
                    يدوي
                  </Badge>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tnum text-[13px] font-semibold text-[var(--text-0)]">
                  {formatKWD(toNumber(item.amount))}
                </span>
                {canDelete && item.isManual && (
                  <span className="print:hidden">
                    <DeleteItemButton id={item.id} />
                  </span>
                )}
              </span>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
        <span className="text-[12px] font-bold text-[var(--text-1)]">الإجمالي</span>
        <span
          className={cn(
            'tnum text-[14px] font-bold',
            tone === 'ok' ? 'text-ok' : 'text-danger'
          )}
        >
          {formatKWD(total)}
        </span>
      </div>
    </div>
  );
}
