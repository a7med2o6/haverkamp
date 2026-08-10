import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { CUSTOMER_SOURCE, JOB_STATUS, ORDER_STATUS } from '@/lib/labels';
import { formatDate, formatKWD, toNumber } from '@/lib/utils';
import { CustomerFormButton } from '../customer-form';
import { VehicleFormButton, DeleteVehicleButton } from './vehicle-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: customer?.name ?? 'العميل' };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('crm:read');
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: 'desc' } },
      jobOrders: {
        orderBy: { receivedAt: 'desc' },
        take: 10,
        include: { vehicle: { select: { make: true, model: true } } },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!customer) notFound();

  const canWrite = can(session.user.role, 'crm:write');
  const canDelete = can(session.user.role, 'crm:delete');
  const totalSpent = customer.orders.reduce((sum, o) => sum + toNumber(o.paidAmount), 0);
  const waNumber = customer.phone.replace(/[^\d]/g, '');

  return (
    <>
      <Link
        href="/dashboard/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى العملاء
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-0)] sm:text-2xl">{customer.name}</h1>
            <Badge tone={CUSTOMER_SOURCE[customer.source].tone}>
              {CUSTOMER_SOURCE[customer.source].label}
            </Badge>
            {customer.isBlocked && <Badge tone="danger">محظور</Badge>}
          </div>
          <p className="tnum mt-1 text-[13px] text-[var(--text-2)]" dir="ltr">
            {customer.code}
          </p>
        </div>

        {canWrite && (
          <CustomerFormButton
            variant="secondary"
            customer={{
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              altPhone: customer.altPhone,
              email: customer.email,
              civilId: customer.civilId,
              address: customer.address,
              area: customer.area,
              notes: customer.notes,
              source: customer.source,
            }}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── بيانات التواصل ── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>بيانات التواصل</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3.5 text-sm">
            <InfoRow icon={<Phone className="size-4" />} label="الهاتف">
              <a href={`tel:${customer.phone}`} className="tnum hover:text-accent" dir="ltr">
                {customer.phone}
              </a>
            </InfoRow>

            {customer.altPhone && (
              <InfoRow icon={<Phone className="size-4" />} label="رقم بديل">
                <span className="tnum" dir="ltr">
                  {customer.altPhone}
                </span>
              </InfoRow>
            )}

            {customer.email && (
              <InfoRow icon={<Mail className="size-4" />} label="البريد">
                <a href={`mailto:${customer.email}`} className="hover:text-accent" dir="ltr">
                  {customer.email}
                </a>
              </InfoRow>
            )}

            {(customer.area || customer.address) && (
              <InfoRow icon={<MapPin className="size-4" />} label="العنوان">
                {[customer.area, customer.address].filter(Boolean).join(' — ')}
              </InfoRow>
            )}

            {customer.civilId && (
              <InfoRow label="الرقم المدني">
                <span className="tnum" dir="ltr">
                  {customer.civilId}
                </span>
              </InfoRow>
            )}

            <InfoRow label="إجمالي المدفوع">
              <span className="tnum font-semibold text-ok">{formatKWD(totalSpent)}</span>
            </InfoRow>

            {customer.notes && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="mb-1 text-[11px] font-semibold text-[var(--text-2)]">ملاحظات</p>
                <p className="text-[13px] leading-relaxed text-[var(--text-1)]">{customer.notes}</p>
              </div>
            )}

            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-ok/15 text-[13px] font-semibold text-ok hover:bg-ok/25"
            >
              <MessageCircle className="size-4" />
              مراسلة على واتساب
            </a>
          </CardBody>
        </Card>

        {/* ── السيارات ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>السيارات ({customer.vehicles.length})</CardTitle>
            {canWrite && <VehicleFormButton customerId={customer.id} />}
          </CardHeader>
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>السيارة</Th>
                  <Th>السنة</Th>
                  <Th>اللون</Th>
                  <Th>رقم اللوحة</Th>
                  {canWrite && <Th />}
                </tr>
              </thead>
              <tbody>
                {customer.vehicles.length === 0 ? (
                  <EmptyState
                    title="لا توجد سيارات مسجّلة"
                    description="أضف سيارة العميل لربطها بأوامر الشغل والكفالات"
                    colSpan={5}
                  />
                ) : (
                  customer.vehicles.map((v) => (
                    <Tr key={v.id}>
                      <Td className="font-medium text-[var(--text-0)]">
                        {v.make} {v.model}
                        {v.vin && (
                          <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                            VIN: {v.vin}
                          </span>
                        )}
                      </Td>
                      <Td className="tnum">{v.year ?? '—'}</Td>
                      <Td>{v.color ?? '—'}</Td>
                      <Td className="tnum" dir="ltr">
                        {v.plateNo ?? '—'}
                      </Td>
                      {canWrite && (
                        <Td>
                          <div className="flex items-center gap-0.5">
                            <VehicleFormButton
                              customerId={customer.id}
                              vehicle={{
                                id: v.id,
                                customerId: customer.id,
                                make: v.make,
                                model: v.model,
                                year: v.year,
                                color: v.color,
                                plateNo: v.plateNo,
                                vin: v.vin,
                                notes: v.notes,
                              }}
                            />
                            {canDelete && (
                              <DeleteVehicleButton id={v.id} customerId={customer.id} />
                            )}
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        {/* ── سجل أوامر الشغل ── */}
        {can(session.user.role, 'workshop:read') && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>سجل أوامر الشغل</CardTitle>
            </CardHeader>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>الرقم</Th>
                    <Th>السيارة</Th>
                    <Th>الاستلام</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.jobOrders.length === 0 ? (
                    <EmptyState title="لا توجد أوامر شغل" colSpan={4} />
                  ) : (
                    customer.jobOrders.map((j) => (
                      <Tr key={j.id}>
                        <Td className="tnum" dir="ltr">
                          <Link
                            href={`/dashboard/job-orders/${j.id}`}
                            className="text-accent hover:underline"
                          >
                            {j.number}
                          </Link>
                        </Td>
                        <Td>{j.vehicle ? `${j.vehicle.make} ${j.vehicle.model}` : '—'}</Td>
                        <Td className="tnum text-[12px]">{formatDate(j.receivedAt)}</Td>
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

        {/* ── الفواتير ── */}
        {can(session.user.role, 'pos:read') && (
          <Card>
            <CardHeader>
              <CardTitle>آخر الفواتير</CardTitle>
            </CardHeader>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>الرقم</Th>
                    <Th>المبلغ</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.length === 0 ? (
                    <EmptyState title="لا توجد فواتير" colSpan={3} />
                  ) : (
                    customer.orders.map((o) => (
                      <Tr key={o.id}>
                        <Td className="tnum" dir="ltr">
                          <Link
                            href={`/dashboard/invoices/${o.id}`}
                            className="text-accent hover:underline"
                          >
                            {o.number}
                          </Link>
                        </Td>
                        <Td className="tnum">{formatKWD(toNumber(o.total))}</Td>
                        <Td>
                          <Badge tone={ORDER_STATUS[o.status].tone}>
                            {ORDER_STATUS[o.status].label}
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
      </div>
    </>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-[var(--text-2)]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--text-2)]">{label}</p>
        <div className="text-[13px] text-[var(--text-1)]">{children}</div>
      </div>
    </div>
  );
}
