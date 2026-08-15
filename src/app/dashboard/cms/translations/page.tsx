import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { SearchBar } from '@/components/dashboard/search-bar';
import { Pagination } from '@/components/dashboard/pagination';
import { StatCard } from '@/components/dashboard/stat-card';
import { Table, TableWrap, Th, EmptyState } from '@/components/ui/table';
import { PAGE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TranslationRow } from './translation-row';

export const metadata: Metadata = { title: 'كل النصوص' };
export const dynamic = 'force-dynamic';

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; page?: string; missing?: string }>;
}) {
  const session = await requirePermission('cms:read');
  const { q, group, page: pageParam, missing } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.TranslationWhereInput = {
    ...(q
      ? {
          OR: [
            { key: { contains: q, mode: 'insensitive' as const } },
            { ar: { contains: q, mode: 'insensitive' as const } },
            { en: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(group ? { group } : {}),
    ...(missing === '1' ? { OR: [{ en: null }, { en: '' }] } : {}),
  };

  const [rows, total, groups, missingCount] = await Promise.all([
    db.translation.findMany({
      where,
      orderBy: { key: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.translation.count({ where }),
    db.translation.groupBy({ by: ['group'], _count: true, orderBy: { group: 'asc' } }),
    db.translation.count({ where: { OR: [{ en: null }, { en: '' }] } }),
  ]);

  const canWrite = can(session.user.role, 'cms:write');
  const allCount = groups.reduce((sum, g) => sum + g._count, 0);

  function chipHref(next: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/dashboard/cms/translations${p.toString() ? `?${p}` : ''}`;
  }

  return (
    <>
      <PageHeader
        title="كل النصوص"
        description="عرض خام لكل نصوص الموقع — المحتوى يُحرَّر من صفحاته في «الصفحة الرئيسية» و«الخدمات» و«الصفحات»، وهذه للبحث والحالات النادرة"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="إجمالي النصوص" value={allCount} icon="Languages" />
        <StatCard
          label="بلا ترجمة إنجليزية"
          value={missingCount}
          icon="TriangleAlert"
          tone={missingCount ? 'warn' : 'ok'}
          href={chipHref({ missing: '1' })}
        />
        <StatCard label="المجموعات" value={groups.length} icon="FolderTree" />
      </div>

      <SearchBar placeholder="ابحث في المفاتيح أو النصوص…" className="mb-3 max-w-md" />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href={chipHref({})}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
            !group && missing !== '1'
              ? 'border-accent bg-accent/15 text-accent-soft'
              : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)]'
          )}
        >
          الكل
        </Link>
        {missingCount > 0 && (
          <Link
            href={chipHref({ missing: '1' })}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              missing === '1'
                ? 'border-warn bg-warn/15 text-warn'
                : 'border-warn/30 text-warn hover:bg-warn/10'
            )}
          >
            ناقصة الإنجليزية ({missingCount})
          </Link>
        )}
        {groups.map((g) => (
          <Link
            key={g.group}
            href={chipHref({ group: g.group })}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              group === g.group
                ? 'border-accent bg-accent/15 text-accent-soft'
                : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)]'
            )}
          >
            {g.group} <span className="tnum opacity-70">({g._count})</span>
          </Link>
        ))}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>المفتاح</Th>
              <Th>العربية</Th>
              <Th>الإنجليزية</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyState
                title="لا توجد نصوص مطابقة"
                description="جرّب مصطلح بحث آخر أو مجموعة مختلفة"
                colSpan={4}
              />
            ) : (
              rows.map((r) => (
                <TranslationRow
                  key={r.key}
                  translationKey={r.key}
                  ar={r.ar}
                  en={r.en}
                  group={r.group}
                  canWrite={canWrite}
                />
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pagination page={page} total={total} />
    </>
  );
}
