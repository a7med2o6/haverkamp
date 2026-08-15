import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { getHomeContent } from '@/lib/service-content';
import { HomeEditor, type HomeStats } from './home-editor';

export const metadata: Metadata = { title: 'الصفحة الرئيسية' };
export const dynamic = 'force-dynamic';

/** أرقام شريط الإحصائيات — قيم عددية في الإعدادات */
const STAT_KEYS = ['stats.years', 'stats.clients', 'stats.cars'] as const;

export default async function HomeContentPage() {
  const session = await requirePermission('cms:read');

  const [groups, settings] = await Promise.all([
    getHomeContent(),
    db.siteSetting.findMany({ where: { key: { in: [...STAT_KEYS] } } }),
  ]);

  const stats = Object.fromEntries(
    STAT_KEYS.map((k) => [k, Number(settings.find((s) => s.key === k)?.value ?? 0)])
  ) as unknown as HomeStats;

  const fieldCount = groups.reduce((n, g) => n + g.fields.length, 0);

  return (
    <>
      <PageHeader
        title="محتوى الصفحة الرئيسية"
        description={`${fieldCount} نصاً في ${groups.length} أقسام — التعديل يظهر على الموقع فور الحفظ`}
      />

      {can(session.user.role, 'cms:write') ? (
        <HomeEditor groups={groups} stats={stats} />
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-2)]">
          ليس لديك صلاحية تحرير المحتوى
        </p>
      )}
    </>
  );
}
