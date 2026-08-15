import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { OTHER_PAGES, getPageContent } from '@/lib/service-content';
import { PageEditor } from './page-editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return { title: OTHER_PAGES[page]?.title ?? 'محتوى صفحة' };
}

export default async function OtherPageContent({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const session = await requirePermission('cms:read');
  const { page } = await params;

  const meta = OTHER_PAGES[page];
  if (!meta) notFound();

  const groups = await getPageContent(page);
  if (groups.length === 0) notFound();

  const fieldCount = groups.reduce((n, g) => n + g.fields.length, 0);

  return (
    <>
      <Link
        href="/dashboard/cms/pages"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى الصفحات
      </Link>

      <PageHeader
        title={`محتوى ${meta.title}`}
        description={`${fieldCount} نصاً في ${groups.length} أقسام — التعديل يظهر على الموقع فور الحفظ`}
      />

      {can(session.user.role, 'cms:write') ? (
        <PageEditor page={page} groups={groups} pageUrl={meta.url} />
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-2)]">
          ليس لديك صلاحية تحرير المحتوى
        </p>
      )}
    </>
  );
}
