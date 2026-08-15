import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { MIGRATED_SERVICES } from '@/lib/site-data';
import { getServiceContent } from '@/lib/service-content';
import { ContentEditor } from './content-editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await db.service.findUnique({
    where: { slug },
    include: { translations: { where: { locale: 'ar' } } },
  });
  return { title: service?.translations[0]?.name ?? 'محتوى الخدمة' };
}

export default async function ServiceContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requirePermission('cms:read');
  const { slug } = await params;

  if (!MIGRATED_SERVICES[slug]) notFound();

  const [service, groups] = await Promise.all([
    db.service.findUnique({ where: { slug }, include: { translations: true } }),
    getServiceContent(slug),
  ]);

  if (!service) notFound();

  const pick = (locale: 'ar' | 'en') => service.translations.find((t) => t.locale === locale);
  const ar = pick('ar');
  const en = pick('en');
  const name = ar?.name ?? slug;

  const meta = {
    cardImage: service.cardImage,
    heroImage: service.heroImage,
    sortOrder: service.sortOrder,
    isActive: service.isActive,
    showInNav: service.showInNav,
    ar: {
      name: ar?.name ?? '',
      tagline: ar?.tagline ?? null,
      shortDesc: ar?.shortDesc ?? null,
      metaTitle: ar?.metaTitle ?? null,
      metaDescription: ar?.metaDescription ?? null,
    },
    en: {
      name: en?.name ?? null,
      tagline: en?.tagline ?? null,
      shortDesc: en?.shortDesc ?? null,
      metaTitle: en?.metaTitle ?? null,
      metaDescription: en?.metaDescription ?? null,
    },
  };
  const fieldCount = groups.reduce((n, g) => n + g.fields.length, 0);
  const canWrite = can(session.user.role, 'cms:write');

  return (
    <>
      <Link
        href="/dashboard/cms/services"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى الخدمات
      </Link>

      <PageHeader
        title={`محتوى صفحة ${name}`}
        description={`${fieldCount} نصاً في ${groups.length} أقسام — التعديل يظهر على الموقع فور الحفظ`}
      />

      {canWrite ? (
        <ContentEditor slug={slug} groups={groups} service={meta} pageUrl={`/${slug}.html`} />
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-2)]">
          ليس لديك صلاحية تحرير المحتوى
        </p>
      )}
    </>
  );
}
