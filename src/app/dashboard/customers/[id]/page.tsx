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
import { BOOKING_STATUS, CUSTOMER_SOURCE, JOB_STATUS, ORDER_STATUS } from '@/lib/labels';
import { expiryStatus, formatDate, formatDateTime, formatKWD, toNumber } from '@/lib/utils';
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
      bookings: {
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        include: {
          service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
          jobOrder: { select: { id: true, number: true } },
        },
      },
    },
  });

  if (!customer) notFound();

  /**
   * الإجماليات من تجميع على كل الفواتير لا من العشرة المعروضة —
   * جمعها من الشريحة يعطي رقماً يزداد خطأً كلما زاد تعامل العميل.
   */
  const [money, visits, lastVisit, warranties] = await Promise.all([
    db.order.aggregate({
      where: { customerId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    db.jobOrder.count({ where: { customerId: id, status: { not: 'CANCELLED' } } }),
    db.jobOrder.findFirst({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    }),
    db.warranty.findMany({
      where: { vehicle: { customerId: id } },
      orderBy: { endDate: 'desc' },
      include: {
        vehicle: { select: { make: true, model: true, plateNo: true } },
        service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
      },
    }),
  ]);

  const canWrite = can(session.user.role, 'crm:write');
  const canDelete = can(session.user.role, 'crm:delete');

  const invoiced = toNumber(money._sum.total ?? 0);
  const totalSpent = toNumber(money._sum.paidAmount ?? 0);
  const outstanding = Math.round((invoiced - totalSpent) * 1000) / 1000;
  const avgInvoice = money._count > 0 ? Math.round((invoiced / money._count) * 1000) / 1000 : 0;

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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="عدد الزيارات" value={String(visits)} />
        <Metric
          label="آخر زيارة"
          value={lastVisit ? formatDate(lastVisit.receivedAt) : '—'}
          hint={lastVisit ? sinceLabel(lastVisit.receivedAt) : 'لم يزر بعد'}
        />
        <Metric label="متوسط الفاتورة" value={formatKWD(avgInvoice)} />
        <Metric
          label={outstanding > 0 ? 'مستحق عليه' : 'إجمالي المدفوع'}
          value={formatKWD(outstanding > 0 ? outstanding : totalSpent)}
          tone={outstanding > 0 ? 'danger' : 'ok'}
        />
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

            {outstanding > 0 && (
              <InfoRow label="مستحق عليه">
                <span className="tnum font-semibold text-danger">{formatKWD(outstanding)}</span>
              </InfoRow>
            )}

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

        {/* ── الحجوزات ── */}
        {customer.bookings.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>الحجوزات</CardTitle>
            </CardHeader>
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>الكود</Th>
                    <Th>الموعد</Th>
                    <Th>الخدمة</Th>
                    <Th>الحالة</Th>
                    <Th>أمر الشغل</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.bookings.map((b) => (
                    <Tr key={b.id}>
                      <Td className="tnum text-[12px]" dir="ltr">
                        {b.code}
                      </Td>
                      <Td className="tnum text-[12px]">{formatDateTime(b.scheduledAt)}</Td>
                      <Td className="text-[12px]">
                        {b.service?.translations[0]?.name ?? '—'}
                      </Td>
                      <Td>
                        <Badge tone={BOOKING_STATUS[b.status].tone}>
                          {BOOKING_STATUS[b.status].label}
                        </Badge>
                      </Td>
                      <Td className="tnum text-[12px]" dir="ltr">
                        {b.jobOrder ? (
                          <Link
                            href={`/dashboard/job-orders/${b.jobOrder.id}`}
                            className="text-accent hover:underline"
                          >
                            {b.jobOrder.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}

        {/* ── الكفالات ── */}
        {warranties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>الكفالات ({warranties.length})</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2.5">
                {warranties.map((w) => {
                  const status = expiryStatus(w.endDate);
                  return (
                    <li
                      key={w.id}
                      className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/dashboard/warranties/${w.id}`}
                          className="tnum text-[13px] font-semibold text-accent hover:underline"
                          dir="ltr"
                        >
                          {w.certificateNo}
                        </Link>
                        {w.isVoid ? (
                          <Badge tone="danger">ملغاة</Badge>
                        ) : (
                          <Badge tone={status.tone === 'neutral' ? 'neutral' : status.tone}>
                            {status.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--text-2)]">
                        {w.service?.translations[0]?.name ?? 'كفالة عامة'} —{' '}
                        {w.vehicle.make} {w.vehicle.model}
                      </p>
                      <p className="tnum text-[11px] text-[var(--text-2)]">
                        حتى {formatDate(w.endDate)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

/** مؤشر مختصر في شريط أعلى الملف */
function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'danger';
}) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-[var(--text-0)]';
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p className={`tnum text-base font-bold ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-2)]">{hint}</p>}
    </div>
  );
}

/** «منذ ٣ أشهر» — لقراءة آخر زيارة بلمحة */
function sinceLabel(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
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
