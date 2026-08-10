import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import * as Icons from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { DOCUMENT_TILES, EMPLOYEE_STATUS, LEAVE_STATUS, LEAVE_TYPE } from '@/lib/labels';
import {
  cn,
  dateOnlyToInput,
  expiryStatus,
  formatDateOnly,
  formatKWD,
  toNumber,
  yearsSince,
} from '@/lib/utils';
import { Avatar } from '../employee-list';
import { EmployeeFormButton } from '../employee-form';
import { AddLeaveButton, DocumentTile, RenewDocumentsButton } from './profile-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await db.employee.findUnique({
    where: { id },
    select: { fullName: true },
  });
  return { title: employee?.fullName ?? 'الموظف' };
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('hr:read');
  const { id } = await params;

  const [employee, departments] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      include: {
        department: { select: { nameAr: true } },
        documents: true,
        leaves: { orderBy: { fromDate: 'desc' } },
      },
    }),
    db.department.findMany({ orderBy: { nameAr: 'asc' }, select: { id: true, nameAr: true } }),
  ]);

  if (!employee) notFound();

  const canWrite = can(session.user.role, 'hr:write');

  const age = yearsSince(employee.birthDate);
  const service = yearsSince(employee.hireDate);

  const docByType = new Map(employee.documents.map((d) => [d.type, d]));
  const passport = docByType.get('PASSPORT');
  const permit = docByType.get('WORK_PERMIT') ?? docByType.get('RESIDENCY');

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]">
      {/* ═══ الترويسة ═══ */}
      <header className="relative flex flex-wrap items-center justify-between gap-4 bg-[#0a1424] px-5 py-6 sm:px-7">
        <div className="flex items-center gap-4">
          <div className="rounded-full ring-2 ring-accent/40">
            <Avatar src={employee.photo} name={employee.fullName} size={76} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white sm:text-2xl">{employee.fullName}</h1>
            {employee.fullNameEn && (
              <p className="text-[13px] text-[#8ea3bf]" dir="ltr">
                {employee.fullNameEn}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-[#dbe6f5]">
                {employee.position}
              </span>
              {employee.department && (
                <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] text-[#8ea3bf]">
                  {employee.department.nameAr}
                </span>
              )}
              {employee.status !== 'ACTIVE' && (
                <Badge tone={EMPLOYEE_STATUS[employee.status].tone}>
                  {EMPLOYEE_STATUS[employee.status].label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <HeroStat label="السن" value={age !== null ? `${age} سنة` : '—'} />
          <HeroStat label="الخدمة" value={service !== null ? `${service} سنة` : '—'} />
          {canWrite && (
            <EmployeeFormButton
              variant="secondary"
              departments={departments}
              employee={{
                id: employee.id,
                fullName: employee.fullName,
                fullNameEn: employee.fullNameEn,
                position: employee.position,
                departmentId: employee.departmentId,
                phone: employee.phone,
                email: employee.email,
                nationality: employee.nationality,
                civilId: employee.civilId,
                birthDate: dateOnlyToInput(employee.birthDate),
                hireDate: dateOnlyToInput(employee.hireDate),
                contractEnd: dateOnlyToInput(employee.contractEnd),
                sponsor: employee.sponsor,
                status: employee.status,
                baseSalary: toNumber(employee.baseSalary),
                allowance: toNumber(employee.allowance),
                bankName: employee.bankName,
                bankAccount: employee.bankAccount,
                bankIban: employee.bankIban,
                photo: employee.photo,
                emergencyContact: employee.emergencyContact,
                annualLeaveDays: employee.annualLeaveDays,
                notes: employee.notes,
              }}
            />
          )}
        </div>
      </header>

      <div className="space-y-7 p-5 sm:p-7">
        {/* ═══ بطاقات المعلومات ═══ */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <InfoCard label="الرقم المدني" value={employee.civilId} ltr />
          <InfoCard label="الجنسية" value={employee.nationality} />
          <InfoCard label="الهاتف" value={employee.phone} ltr highlight="accent" />
          <InfoCard label="الكفيل" value={employee.sponsor} />
          <InfoCard
            label="التعيين"
            value={formatDateOnly(employee.hireDate)}
            highlight="warn"
          />
        </div>

        {/* ═══ البيانات المالية ═══ */}
        <section>
          <SectionTitle>البيانات المالية</SectionTitle>
          <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-ok/25 bg-ok/[0.07] p-5 lg:grid-cols-4">
            <Money label="الراتب" value={toNumber(employee.baseSalary) > 0 ? formatKWD(toNumber(employee.baseSalary) + toNumber(employee.allowance)) : null} />
            <Money label="البنك" value={employee.bankName} />
            <Money label="الحساب" value={employee.bankAccount} ltr />
            <Money label="الآيبان IBAN" value={employee.bankIban} ltr />
          </div>
        </section>

        {/* ═══ التواريخ الحساسة ═══ */}
        <section>
          <SectionTitle
            action={
              canWrite ? (
                <RenewDocumentsButton
                  employeeId={employee.id}
                  passportExpiry={dateOnlyToInput(passport?.expiryDate)}
                  permitExpiry={dateOnlyToInput(permit?.expiryDate)}
                  permitType={permit?.type ?? 'WORK_PERMIT'}
                />
              ) : null
            }
          >
            التواريخ الحساسة
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <CriticalDate label="الإقامة / إذن العمل" date={permit?.expiryDate ?? null} />
            <CriticalDate label="انتهاء الجواز" date={passport?.expiryDate ?? null} />
          </div>
        </section>

        {/* ═══ الوثائق ═══ */}
        <section>
          <SectionTitle>الوثائق</SectionTitle>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {DOCUMENT_TILES.map((tile) => {
              const doc = docByType.get(tile.type);
              return (
                <DocumentTile
                  key={tile.type}
                  employeeId={employee.id}
                  type={tile.type}
                  label={tile.label}
                  icon={tile.icon}
                  canWrite={canWrite}
                  document={
                    doc
                      ? {
                          id: doc.id,
                          number: doc.number,
                          issueDate: dateOnlyToInput(doc.issueDate),
                          expiryDate: dateOnlyToInput(doc.expiryDate),
                          fileUrl: doc.fileUrl,
                          notes: doc.notes,
                        }
                      : null
                  }
                />
              );
            })}
          </div>
        </section>

        {/* ═══ سجل الإجازات ═══ */}
        <section>
          <SectionTitle
            action={canWrite ? <AddLeaveButton employeeId={employee.id} /> : null}
          >
            سجل الإجازات
          </SectionTitle>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>البداية</Th>
                  <Th>النهاية</Th>
                  <Th>المدة</Th>
                  <Th>النوع</Th>
                  <Th>الحالة</Th>
                  <Th>ملاحظات</Th>
                </tr>
              </thead>
              <tbody>
                {employee.leaves.length === 0 ? (
                  <EmptyState
                    title="لا توجد إجازات مسجّلة"
                    description="أضف إجازة من الزر أعلى الجدول"
                    colSpan={6}
                  />
                ) : (
                  employee.leaves.map((l) => (
                    <Tr key={l.id}>
                      <Td className="tnum text-[12px]">{formatDateOnly(l.fromDate)}</Td>
                      <Td className="tnum text-[12px]">{formatDateOnly(l.toDate)}</Td>
                      <Td className="tnum font-bold text-accent">{l.days} يوم</Td>
                      <Td>
                        <Badge tone={LEAVE_TYPE[l.type].tone}>{LEAVE_TYPE[l.type].label}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={LEAVE_STATUS[l.status].tone}>
                          {LEAVE_STATUS[l.status].label}
                        </Badge>
                      </Td>
                      <Td className="text-[12px]">{l.reason ?? '—'}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </section>
      </div>
    </div>
  );
}

/* ── مكوّنات العرض ─────────────────────────────────────── */

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-white/12 bg-white/[0.06] px-4 py-2.5 text-center">
      <p className="text-[11px] text-[#8ea3bf]">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-bold text-white">{value}</p>
    </div>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5">
      <h2 className="text-[15px] font-bold text-[var(--text-0)]">{children}</h2>
      {action}
    </div>
  );
}

function InfoCard({
  label,
  value,
  ltr,
  highlight,
}: {
  label: string;
  value: string | null;
  ltr?: boolean;
  highlight?: 'accent' | 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border px-4 py-3 text-center',
        highlight === 'accent'
          ? 'border-accent/30 bg-accent/[0.07]'
          : highlight === 'warn'
            ? 'border-warn/30 bg-warn/[0.07]'
            : 'border-[var(--line)] bg-[var(--surface-2)]'
      )}
    >
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p
        className={cn('mt-1 text-[15px] font-bold text-[var(--text-0)]', ltr && 'tnum')}
        dir={ltr ? 'ltr' : undefined}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function Money({ label, value, ltr }: { label: string; value: string | null; ltr?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p
        className={cn(
          'mt-1 font-bold',
          value ? 'text-[var(--text-0)]' : 'text-[var(--text-2)]',
          // الآيبان يصل إلى 30 خانة — نكسره على أكثر من سطر بدل أن يطفح على الخانة المجاورة
          ltr ? 'tnum break-all text-[12px] leading-snug' : 'text-[14px]'
        )}
        dir={ltr ? 'ltr' : undefined}
      >
        {value || '---'}
      </p>
    </div>
  );
}

function CriticalDate({ label, date }: { label: string; date: Date | null }) {
  const status = expiryStatus(date);
  const Icon =
    status.tone === 'danger'
      ? Icons.TriangleAlert
      : status.tone === 'warn'
        ? Icons.Clock
        : Icons.ShieldCheck;

  const colors = {
    danger: 'border-danger/35 bg-danger/[0.08] text-danger',
    warn: 'border-warn/35 bg-warn/[0.08] text-warn',
    ok: 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-0)]',
    neutral: 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)]',
  }[status.tone];

  return (
    <div className={cn('rounded-[var(--radius-md)] border px-5 py-4 text-center', colors)}>
      <p className="text-[12px] text-[var(--text-2)]">{label}</p>
      <p className="tnum mt-1.5 text-[18px] font-bold" dir="ltr">
        {date ? formatDateOnly(date) : '—'}
      </p>
      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-medium">
        <Icon className="size-3.5" />
        {status.label}
      </p>
    </div>
  );
}
