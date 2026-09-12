import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { CarFront } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { PAGE_SIZE } from '@/lib/constants';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { vehicleIdsByPlate } from '@/lib/search-db';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'السيارات' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'warranty', label: 'بكفالة سارية' },
  { key: 'expired', label: 'كفالة منتهية' },
] as const;

function listHref(filter: string, q?: string) {
  const params = new URLSearchParams({ filter });
  if (q) params.set('q', q);
  return `/dashboard/vehicles?${params}`;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  // لا زرّ إضافة في هذه الصفحة، فلا حاجة إلى الجلسة بعد التحقّق
  await requirePermission('crm:read');
  const { q, page: pageParam, filter: filterParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  /*
    المَعلمة تأتي من الرابط فتقبل أي نص، لذلك تُحصر في المفاتيح المعروفة
    قبل أن تدخل في بناء استعلام Prisma، ويعود غير المعروف إلى «الكل».
  */
  const filter = FILTERS.some((item) => item.key === filterParam)
    ? (filterParam as (typeof FILTERS)[number]['key'])
    : 'all';

  const now = new Date();
  const liveWarranty: Prisma.WarrantyWhereInput = {
    isVoid: false,
    endDate: { gte: now },
  };
  const byFilter: Prisma.VehicleWhereInput =
    filter === 'warranty'
      ? { warranties: { some: liveWarranty } }
      : filter === 'expired'
        ? {
            AND: [
              { warranties: { some: {} } },
              { warranties: { none: liveWarranty } },
            ],
          }
        : {};

  const plateIds = q ? await vehicleIdsByPlate(q) : [];
  const searchBranches: Prisma.VehicleWhereInput[] = [];
  if (q) {
    if (plateIds.length > 0) {
      searchBranches.push({ id: { in: plateIds } });
    }
    searchBranches.push(
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { customer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { phone: { contains: q } } } }
    );
  }

  const where: Prisma.VehicleWhereInput = q
    ? { AND: [byFilter, { OR: searchBranches }] }
    : byFilter;

  const [vehicles, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { jobOrders: true } },
        jobOrders: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { receivedAt: true },
        },
        warranties: { select: { isVoid: true, endDate: true } },
      },
    }),
    db.vehicle.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="السيارات" description={`${total} سيارة مسجّلة`} />

      <SearchBar
        placeholder="ابحث باللوحة أو الماركة أو الموديل أو المالك…"
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
        <Table>
          <thead>
            <tr>
              <Th>اللوحة</Th>
              <Th>السيارة</Th>
              <Th>السنة</Th>
              <Th>المالك</Th>
              <Th>أوامر الشغل</Th>
              <Th>آخر أمر شغل</Th>
              <Th>الكفالة</Th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <EmptyState
                title={
                  q
                    ? 'لا توجد نتائج مطابقة'
                    : filter !== 'all'
                      ? 'لا توجد سيارات في هذا التصنيف'
                      : 'لا توجد سيارات بعد'
                }
                description={
                  q
                    ? 'جرّب مصطلح بحث آخر'
                    : filter !== 'all'
                      ? 'جرّب اختيار تصنيف آخر'
                      : 'تُضاف السيارة من ملف العميل المرتبط بها'
                }
                colSpan={7}
                icon={<CarFront className="size-6" />}
              />
            ) : (
              vehicles.map((vehicle) => {
                const hasWarranty = vehicle.warranties.length > 0;
                const hasLiveWarranty = vehicle.warranties.some(
                  (warranty) => !warranty.isVoid && warranty.endDate >= now
                );

                return (
                  <Tr key={vehicle.id}>
                    <Td className="tnum whitespace-nowrap text-end" dir="ltr">
                      {vehicle.plateNo ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/dashboard/customers/${vehicle.customer.id}`}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {vehicle.make} {vehicle.model}
                      </Link>
                    </Td>
                    <Td className="tnum">{vehicle.year ?? '—'}</Td>
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/dashboard/customers/${vehicle.customer.id}`}
                        className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                      >
                        {vehicle.customer.name}
                      </Link>
                    </Td>
                    <Td className="tnum">{vehicle._count.jobOrders}</Td>
                    <Td className="tnum whitespace-nowrap text-[12px]">
                      {vehicle.jobOrders[0] ? formatDate(vehicle.jobOrders[0].receivedAt) : '—'}
                    </Td>
                    <Td>
                      <Badge tone={hasLiveWarranty ? 'ok' : hasWarranty ? 'muted' : 'neutral'}>
                        {hasLiveWarranty ? 'سارية' : hasWarranty ? 'منتهية' : '—'}
                      </Badge>
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
