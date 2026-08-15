import Link from 'next/link';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { requirePermission } from '@/lib/guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { OTHER_PAGES, getPageContent } from '@/lib/service-content';

export const metadata: Metadata = { title: 'الصفحات' };
export const dynamic = 'force-dynamic';

export default async function CmsPagesIndex() {
  await requirePermission('cms:read');

  const pages = await Promise.all(
    Object.entries(OTHER_PAGES).map(async ([slug, meta]) => {
      const groups = await getPageContent(slug);
      return {
        slug,
        ...meta,
        fields: groups.reduce((n, g) => n + g.fields.length, 0),
        sections: groups.length,
      };
    })
  );

  return (
    <>
      <PageHeader
        title="الصفحات"
        description="صفحات الموقع خارج الخدمات — نصوصها تُحرَّر من هنا"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <Link
            key={p.slug}
            href={`/dashboard/cms/pages/${p.slug}`}
            className="group rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 transition-colors hover:border-accent hover:bg-[var(--surface-2)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors group-hover:text-accent">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--text-0)]">{p.title}</p>
                <p className="tnum mt-0.5 text-[12px] text-[var(--text-2)]" dir="ltr">
                  {p.url}
                </p>
                <p className="mt-2 text-[12px] text-[var(--text-2)]">
                  {p.fields} نصاً في {p.sections} أقسام
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
