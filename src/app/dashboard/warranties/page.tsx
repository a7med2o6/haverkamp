import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { customerIdsByPhone } from '@/lib/search-db';
import { serviceStatus, warrantyLabel, warrantyPartLabels } from '@/lib/intake';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EXPIRY_ALERT_DAYS, PAGE_SIZE } from '@/lib/constants';
import { cn, expiryStatus, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'الكفالات' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'valid', label: 'سارية' },
  { key: 'service', label: 'متأخرة عن السيرفس' },
  { key: 'expiring', label: 'تنتهي قريباً' },
  { key: 'expired', label: 'منتهية' },
  { key: 'void', label: 'ملغاة' },
  { key: 'all', label: 'الكل' },
] as const;

const WARRANTY_INCLUDE = {
  vehicle: {
    select: {
      make: true,
      model: true,
      plateNo: true,
      customer: { select: { id: true, name: true, phone: true } },
      // آخر زيارة تكفي لحساب حال السيرفس
      services: { orderBy: { visitedAt: 'desc' }, take: 1 },
    },
  },
  service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
  jobOrder: { select: { id: true, number: true } },
} satisfies Prisma.WarrantyInclude;

/**
 * الكفالات التي انقطع أصحابها عن السيرفس.
 *
 * لا تُستخرج بشرط في الاستعلام: الموعد يُحسب من آخر زيارة ومن دورية كل
 * كفالة، وذلك حسابٌ لا يُكتب في `where`. فتُقرأ المشروطة السارية وحدها
 * — وهي قليلة، كفالات البدي دون غيرها — ثم تُصفّى.
 */
function buildWhere(
  filter: string,
  now: Date,
  soon: Date,
  q?: string
, phoneIds: string[] = []): Prisma.WarrantyWhereInput {
  const byFilter: Prisma.WarrantyWhereInput =
    filter === 'valid'
      ? { isVoid: false, endDate: { gte: now } }
      : filter === 'expiring'
        ? { isVoid: false, endDate: { gte: now, lte: soon } }
        : filter === 'expired'
          ? { isVoid: false, endDate: { lt: now } }
          : filter === 'void'
            ? { isVoid: true }
            : {};

  if (!q) return byFilter;

  return {
    AND: [
      byFilter,
      {
        OR: [
          { certificateNo: { contains: q, mode: 'insensitive' } },
          { vehicle: { plateNo: { contains: q, mode: 'insensitive' } } },
          { vehicle: { customer: { name: { contains: q, mode: 'insensitive' } } } },
          ...(phoneIds.length > 0
            ? [{ vehicle: { customer: { id: { in: phoneIds } } } }]
            : []),
          { jobOrder: { number: { contains: q, mode: 'insensitive' } } },
        ],
      },
    ],
  };
}

export default async function WarrantiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  await requirePermission('crm:read');
  const { q, filter = 'valid', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRY_ALERT_DAYS * 86400000);
  const phoneIds = q ? await customerIdsByPhone(q) : [];
  const where = buildWhere(filter, now, soon, q, phoneIds);

  // المشروطة السارية — منها يُحسب المتأخر، وعليها يقوم الفلتر وعدّاده
  const conditioned = await db.warranty.findMany({
    where: {
      isVoid: false,
      endDate: { gte: now },
      serviceEveryMonths: { not: null },
      ...(filter === 'service' ? buildWhere('all', now, soon, q) : {}),
    },
    orderBy: { startDate: 'asc' },
    include: WARRANTY_INCLUDE,
  });

  const overdue = conditioned.filter(
    (w) => serviceStatus(w, w.vehicle.services[0]?.visitedAt ?? null).tone === 'danger'
  );

  const isServiceFilter = filter === 'service';

  const [paged, counted, expiringCount] = await Promise.all([
    isServiceFilter
      ? overdue.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : db.warranty.findMany({
          where,
          orderBy: { endDate: 'asc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: WARRANTY_INCLUDE,
        }),
    isServiceFilter ? overdue.length : db.warranty.count({ where }),
    db.warranty.count({
      where: { isVoid: false, endDate: { gte: now, lte: soon } },
    }),
  ]);

  const warranties = paged;
  const total = counted;

  return (
    <>
      <PageHeader title="الكفالات" description={`${total} شهادة`} />

      {overdue.length > 0 && !isServiceFilter && (
        <Link
          href="/dashboard/warranties?filter=service"
          className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger hover:border-danger/50"
        >
          <span className="tnum font-bold">{overdue.length}</span>
          كفالة انقطع صاحبها عن السيرفس الدوري — اضغط للعرض
        </Link>
      )}

      {expiringCount > 0 && filter !== 'expiring' && (
        <Link
          href="/dashboard/warranties?filter=expiring"
          className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn hover:border-warn/50"
        >
          <span className="tnum font-bold">{expiringCount}</span>
          كفالة تنتهي خلال {EXPIRY_ALERT_DAYS} يوم — اضغط للعرض
        </Link>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="ابحث برقم الشهادة أو اللوحة أو العميل…"
          className="sm:max-w-md"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/dashboard/warranties?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                filter === f.key
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>رقم الشهادة</Th>
              <Th>العميل</Th>
              <Th>السيارة</Th>
              <Th>الخدمة</Th>
              <Th>من</Th>
              <Th>حتى</Th>
              <Th>الحالة</Th>
              <Th>السيرفس</Th>
              <Th>أمر الشغل</Th>
            </tr>
          </thead>
          <tbody>
            {warranties.length === 0 ? (
              <EmptyState
                title="لا توجد كفالات"
                description="تُصدر الكفالات من صفحة أمر الشغل"
                colSpan={9}
              />
            ) : (
              warranties.map((w) => {
                const status = expiryStatus(w.endDate);
                const svc = serviceStatus(w, w.vehicle.services[0]?.visitedAt ?? null);
                return (
                  <Tr key={w.id}>
                    <Td className="tnum" dir="ltr">
                      <Link
                        href={`/dashboard/warranties/${w.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {w.certificateNo}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/customers/${w.vehicle.customer.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {w.vehicle.customer.name}
                      </Link>
                      <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                        {w.vehicle.customer.phone}
                      </span>
                    </Td>
                    <Td className="text-[12px]">
                      {w.vehicle.make} {w.vehicle.model}
                      {w.vehicle.plateNo && (
                        <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                          {w.vehicle.plateNo}
                        </span>
                      )}
                    </Td>
                    <Td className="text-[12px]">
                      {warrantyLabel(w)}
                      {w.parts.length > 0 && (
                        <span className="block text-[11px] text-[var(--text-2)]">
                          {warrantyPartLabels(w.parts).join('، ')}
                        </span>
                      )}
                    </Td>
                    <Td className="tnum text-[12px]">{formatDate(w.startDate)}</Td>
                    <Td className="tnum text-[12px]">{formatDate(w.endDate)}</Td>
                    <Td>
                      {w.isVoid ? (
                        <Badge tone="danger">ملغاة</Badge>
                      ) : (
                        <Badge tone={status.tone === 'neutral' ? 'neutral' : status.tone}>
                          {status.label}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {svc.required ? (
                        <>
                          <Badge tone={svc.tone}>{svc.label}</Badge>
                          <span className="tnum block text-[11px] text-[var(--text-2)]">
                            {w.vehicle.services[0]
                              ? `آخر زيارة ${formatDate(w.vehicle.services[0].visitedAt)}`
                              : 'لم يزر بعد'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[12px] text-[var(--text-2)]">—</span>
                      )}
                    </Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {w.jobOrder ? (
                        <Link
                          href={`/dashboard/job-orders/${w.jobOrder.id}`}
                          className="text-accent hover:underline"
                        >
                          {w.jobOrder.number}
                        </Link>
                      ) : (
                        '—'
                      )}
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
