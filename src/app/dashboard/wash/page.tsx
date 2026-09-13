import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { Droplets } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { PAGE_SIZE } from '@/lib/constants';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { customerIdsByPhone, vehicleIdsByPlate } from '@/lib/search-db';
import { withFrom } from '@/lib/back-link';
import {
  cn,
  dateOnlyToInput,
  formatDateOnly,
  formatKWD,
  toNumber,
} from '@/lib/utils';
import { WashSubscriptionFormButton } from './subscription-form';

export const metadata: Metadata = { title: 'اشتراكات الغسيل' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'active', label: 'السارية', status: 'ACTIVE' },
  { key: 'paused', label: 'الموقوفة', status: 'PAUSED' },
  { key: 'ended', label: 'المنتهية', status: 'ENDED' },
  { key: 'all', label: 'الكل', status: null },
] as const;

function listHref(filter: string, q?: string, page?: number) {
  const params = new URLSearchParams({ filter });
  if (q) params.set('q', q);
  if (page && page > 1) params.set('page', String(page));
  return `/dashboard/wash?${params}`;
}

export default async function WashSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const session = await requirePermission('wash:read');
  const { q, page: pageParam, filter: filterParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  /*
    قيمة الرابط نصّ غير موثوق، لذلك لا تدخل في enum بريزما إلا بعد
    حصرها في الحالات الأربع المعروفة، وما عداها يعود إلى السارية.
  */
  const selectedFilter = FILTERS.find((item) => item.key === filterParam) ?? FILTERS[0];
  const filter = selectedFilter.key;
  const byFilter: Prisma.WashSubscriptionWhereInput = selectedFilter.status
    ? { status: selectedFilter.status }
    : {};

  const [plateIds, phoneIds] = q
    ? await Promise.all([vehicleIdsByPlate(q), customerIdsByPhone(q)])
    : [[], []];
  const searchBranches: Prisma.WashSubscriptionWhereInput[] = [];
  if (q) {
    searchBranches.push(
      { code: { contains: q, mode: 'insensitive' } },
      { customer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { area: { contains: q, mode: 'insensitive' } }
    );
    if (phoneIds.length > 0) searchBranches.push({ customerId: { in: phoneIds } });
    if (plateIds.length > 0) searchBranches.push({ vehicleId: { in: plateIds } });
  }

  const where: Prisma.WashSubscriptionWhereInput = q
    ? { AND: [byFilter, { OR: searchBranches }] }
    : byFilter;
  const canWrite = can(session.user.role, 'wash:write');

  const [subscriptions, total, customers, packages, washers] = await Promise.all([
    db.washSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true } },
        vehicle: { select: { id: true, make: true, model: true, plateNo: true } },
      },
    }),
    db.washSubscription.count({ where }),
    canWrite
      ? db.customer.findMany({
          orderBy: { name: 'asc' },
          take: 500,
          select: { id: true, name: true, phone: true },
        })
      : Promise.resolve([]),
    canWrite
      ? db.servicePackage.findMany({
          where: { service: { slug: 'wash' } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            price: true,
            isActive: true,
            translations: { where: { locale: 'ar' }, select: { name: true } },
          },
        })
      : Promise.resolve([]),
    canWrite
      ? db.employee.findMany({
          where: { status: 'ACTIVE', skills: { has: 'WASHING' } },
          orderBy: { fullName: 'asc' },
          select: { id: true, code: true, fullName: true },
        })
      : Promise.resolve([]),
  ]);

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
  }));
  const packageOptions = packages.map((servicePackage) => ({
    id: servicePackage.id,
    price: toNumber(servicePackage.price),
    label: `${servicePackage.translations[0]?.name ?? 'باقة غسيل'} — ${formatKWD(
      toNumber(servicePackage.price)
    )}${servicePackage.isActive ? '' : ' — غير مفعّلة'}`,
  }));
  const here = listHref(filter, q, page);
  const washerOptions = washers.map((washer) => ({
    id: washer.id,
    label: `${washer.fullName} — ${washer.code}`,
  }));

  return (
    <>
      <PageHeader
        title="اشتراكات الغسيل"
        description={`${total} اشتراك`}
        actions={
          canWrite ? (
            <WashSubscriptionFormButton
              customers={customerOptions}
              packages={packageOptions}
              washers={washerOptions}
            />
          ) : null
        }
      />

      <SearchBar
        placeholder="ابحث بالكود أو العميل أو الهاتف أو اللوحة أو المنطقة…"
        className="mb-4 max-w-md"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={listHref(item.key, q)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filter === item.key
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <TableWrap>
        <Table className="min-w-[920px]">
          <thead>
            <tr>
              <Th>الكود</Th>
              <Th>العميل</Th>
              <Th>السيارة</Th>
              <Th>المنطقة</Th>
              <Th>بدأ في</Th>
              <Th>الاشتراك الشهري</Th>
              <Th>الحالة</Th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <EmptyState
                title={
                  q
                    ? 'لا توجد نتائج مطابقة'
                    : filter === 'all'
                      ? 'لا توجد اشتراكات غسيل بعد'
                      : 'لا توجد اشتراكات في هذه الحالة'
                }
                description={
                  q
                    ? 'جرّب كوداً أو اسماً أو هاتفاً أو لوحة أو منطقة أخرى'
                    : filter === 'all'
                      ? 'أنشئ أول عقد غسيل متنقّل من الزر أعلاه'
                      : 'اختر حالة أخرى أو أنشئ اشتراكاً جديداً'
                }
                colSpan={7}
                icon={<Droplets className="size-6" />}
              />
            ) : (
              subscriptions.map((subscription) => {
                const profileHref = withFrom(
                  `/dashboard/customers/${subscription.customer.id}`,
                  here
                );
                const status = {
                  ACTIVE: { tone: 'ok' as const, label: 'سارٍ' },
                  PAUSED: { tone: 'warn' as const, label: 'موقوف' },
                  ENDED: { tone: 'muted' as const, label: 'منتهٍ' },
                }[subscription.status];

                return (
                  <Tr key={subscription.id}>
                    <Td className="tnum whitespace-nowrap font-semibold" dir="ltr">
                      <Link
                        href={`/dashboard/wash/${subscription.id}`}
                        className="text-accent hover:underline"
                      >
                        {subscription.code}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link
                        href={profileHref}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {subscription.customer.name}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link
                        href={profileHref}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {subscription.vehicle.make} {subscription.vehicle.model}
                        {subscription.vehicle.plateNo && (
                          <span className="tnum ms-2 text-[12px] text-[var(--text-2)]" dir="ltr">
                            {subscription.vehicle.plateNo}
                          </span>
                        )}
                      </Link>
                    </Td>
                    <Td>{subscription.area}</Td>
                    <Td className="tnum whitespace-nowrap text-[12px]">
                      {formatDateOnly(subscription.startDate)}
                    </Td>
                    <Td className="tnum whitespace-nowrap font-semibold">
                      {formatKWD(toNumber(subscription.monthlyPrice))}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {canWrite && (
                          <WashSubscriptionFormButton
                            compact
                            customers={customerOptions}
                            packages={packageOptions}
                            washers={washerOptions}
                            initialVehicles={[
                              {
                                id: subscription.vehicle.id,
                                label: `${subscription.vehicle.make} ${subscription.vehicle.model}`,
                                plateNo: subscription.vehicle.plateNo,
                              },
                            ]}
                            subscription={{
                              id: subscription.id,
                              customerId: subscription.customerId,
                              vehicleId: subscription.vehicleId,
                              servicePackageId: subscription.servicePackageId,
                              defaultWasherId: subscription.defaultWasherId,
                              area: subscription.area,
                              block: subscription.block,
                              street: subscription.street,
                              building: subscription.building,
                              locationNotes: subscription.locationNotes,
                              startDate: dateOnlyToInput(subscription.startDate),
                              monthlyPrice: subscription.monthlyPrice.toString(),
                              notes: subscription.notes,
                            }}
                          />
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
    </>
  );
}
