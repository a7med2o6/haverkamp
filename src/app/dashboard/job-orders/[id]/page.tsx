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
import { JOB_STATUS } from '@/lib/labels';
import { formatDate, formatDateTime, formatKWD, toNumber } from '@/lib/utils';
import {
  AssigneePicker,
  CreateInvoiceButton,
  IssueWarrantyButton,
  JobItemActions,
  JobItemForm,
  JobStatusSelect,
} from '../job-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await db.jobOrder.findUnique({ where: { id }, select: { number: true } });
  return { title: job?.number ?? 'أمر شغل' };
}

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('workshop:read');
  const { id } = await params;

  const [job, technicians, products, services] = await Promise.all([
    db.jobOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        items: { orderBy: { id: 'asc' } },
        assignees: true,
        warranties: { include: { service: { include: { translations: { where: { locale: 'ar' } } } } } },
        order: { select: { id: true, number: true } },
        booking: { select: { code: true } },
      },
    }),
    db.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { nameAr: 'asc' },
      select: { id: true, nameAr: true, price: true },
    }),
    db.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
    }),
  ]);

  if (!job) notFound();

  const canWrite = can(session.user.role, 'workshop:write');
  const canInvoice = can(session.user.role, 'pos:write');
  const canWarranty = can(session.user.role, 'crm:write');

  const totalValue = job.items.reduce((s, i) => s + toNumber(i.total), 0);
  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: s.translations[0]?.name ?? s.slug,
  }));

  return (
    <>
      <Link
        href="/dashboard/job-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى أوامر الشغل
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tnum text-xl font-bold text-[var(--text-0)] sm:text-2xl" dir="ltr">
              {job.number}
            </h1>
            <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
            {job.booking && <Badge tone="accent">من الحجز {job.booking.code}</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            استُلمت {formatDateTime(job.receivedAt)}
            {job.promisedAt && ` · التسليم المتوقّع ${formatDateTime(job.promisedAt)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <JobStatusSelect id={job.id} status={job.status} />}
          {canInvoice && !job.order && job.items.length > 0 && (
            <CreateInvoiceButton jobOrderId={job.id} />
          )}
          {canWarranty && job.vehicleId && (
            <IssueWarrantyButton jobOrderId={job.id} services={serviceOptions} />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── العميل والسيارة ── */}
        <Card>
          <CardHeader>
            <CardTitle>العميل والسيارة</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-[13px]">
            <Info label="العميل">
              <Link
                href={`/dashboard/customers/${job.customer.id}`}
                className="font-medium text-accent hover:underline"
              >
                {job.customer.name}
              </Link>
            </Info>
            <Info label="الهاتف">
              <span className="tnum" dir="ltr">
                {job.customer.phone}
              </span>
            </Info>
            {job.vehicle && (
              <>
                <Info label="السيارة">
                  {job.vehicle.make} {job.vehicle.model}
                  {job.vehicle.year ? ` — ${job.vehicle.year}` : ''}
                </Info>
                {job.vehicle.plateNo && (
                  <Info label="رقم اللوحة">
                    <span className="tnum" dir="ltr">
                      {job.vehicle.plateNo}
                    </span>
                  </Info>
                )}
              </>
            )}
            {job.odometer && (
              <Info label="قراءة العداد">
                <span className="tnum">{job.odometer.toLocaleString('en-US')} كم</span>
              </Info>
            )}
            {job.intakeNotes && (
              <div className="rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 p-3">
                <p className="mb-1 text-[11px] font-semibold text-warn">ملاحظات الاستلام</p>
                <p className="text-[12px] leading-relaxed text-[var(--text-1)]">
                  {job.intakeNotes}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── البنود ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>بنود الشغل — {formatKWD(totalValue)}</CardTitle>
            {canWrite && <JobItemForm jobOrderId={job.id} products={products.map((p) => ({ ...p, price: toNumber(p.price) }))} />}
          </CardHeader>
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>البند</Th>
                  <Th>الكمية</Th>
                  <Th>السعر</Th>
                  <Th>الإجمالي</Th>
                  {canWrite && <Th>منجز</Th>}
                </tr>
              </thead>
              <tbody>
                {job.items.length === 0 ? (
                  <EmptyState
                    title="لا توجد بنود"
                    description="أضف الخدمات والقطع المطلوبة لهذا الأمر"
                    colSpan={5}
                  />
                ) : (
                  job.items.map((item) => (
                    <Tr key={item.id}>
                      <Td
                        className={
                          item.isDone
                            ? 'text-[var(--text-2)] line-through'
                            : 'text-[var(--text-0)]'
                        }
                      >
                        {item.label}
                      </Td>
                      <Td className="tnum">{toNumber(item.qty)}</Td>
                      <Td className="tnum">{formatKWD(toNumber(item.unitPrice))}</Td>
                      <Td className="tnum font-semibold">{formatKWD(toNumber(item.total))}</Td>
                      {canWrite && (
                        <Td>
                          <JobItemActions
                            id={item.id}
                            jobOrderId={job.id}
                            isDone={item.isDone}
                          />
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        {/* ── الفنيون ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الفنيون المسؤولون</CardTitle>
          </CardHeader>
          <CardBody>
            {canWrite ? (
              <AssigneePicker
                jobOrderId={job.id}
                employees={technicians}
                assigned={job.assignees.map((a) => a.employeeId)}
              />
            ) : job.assignees.length > 0 ? (
              <p className="text-[13px] text-[var(--text-1)]">
                {job.assignees.length} فني مُسنَد
              </p>
            ) : (
              <p className="text-[13px] text-[var(--text-2)]">لم يُسنَد أي فني بعد</p>
            )}
          </CardBody>
        </Card>

        {/* ── الكفالات ── */}
        <Card>
          <CardHeader>
            <CardTitle>الكفالات</CardTitle>
          </CardHeader>
          <CardBody>
            {job.warranties.length === 0 ? (
              <p className="text-[13px] text-[var(--text-2)]">لم تُصدر كفالات لهذا الأمر</p>
            ) : (
              <ul className="space-y-2.5">
                {job.warranties.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3"
                  >
                    <p className="tnum text-[13px] font-semibold text-[var(--text-0)]" dir="ltr">
                      {w.certificateNo}
                    </p>
                    <p className="text-[12px] text-[var(--text-2)]">
                      {w.service?.translations[0]?.name ?? 'كفالة عامة'}
                    </p>
                    <p className="tnum text-[11px] text-[var(--text-2)]">
                      حتى {formatDate(w.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <div className="text-[var(--text-1)]">{children}</div>
    </div>
  );
}
