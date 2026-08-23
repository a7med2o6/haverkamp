import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
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
  { key: 'expiring', label: 'تنتهي قريباً' },
  { key: 'expired', label: 'منتهية' },
  { key: 'void', label: 'ملغاة' },
  { key: 'all', label: 'الكل' },
] as const;

function buildWhere(
  filter: string,
  now: Date,
  soon: Date,
  q?: string
): Prisma.WarrantyWhereInput {
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
          { vehicle: { customer: { phone: { contains: q } } } },
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
  const where = buildWhere(filter, now, soon, q);

  const [warranties, total, expiringCount] = await Promise.all([
    db.warranty.findMany({
      where,
      orderBy: { endDate: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        vehicle: {
          select: {
            make: true,
            model: true,
            plateNo: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
        jobOrder: { select: { id: true, number: true } },
      },
    }),
    db.warranty.count({ where }),
    db.warranty.count({
      where: { isVoid: false, endDate: { gte: now, lte: soon } },
    }),
  ]);

  return (
    <>
      <PageHeader title="الكفالات" description={`${total} شهادة`} />

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
              <Th>أمر الشغل</Th>
            </tr>
          </thead>
          <tbody>
            {warranties.length === 0 ? (
              <EmptyState
                title="لا توجد كفالات"
                description="تُصدر الكفالات من صفحة أمر الشغل"
                colSpan={8}
              />
            ) : (
              warranties.map((w) => {
                const status = expiryStatus(w.endDate);
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
                      {w.service?.translations[0]?.name ?? 'كفالة عامة'}
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
