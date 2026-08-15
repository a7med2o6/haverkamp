import Image from 'next/image';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MIGRATED_SERVICES } from '@/lib/site-data';
import { ServiceFormButton, ToggleServiceButton } from './service-form';

export const metadata: Metadata = { title: 'الخدمات' };
export const dynamic = 'force-dynamic';

export default async function CmsServicesPage() {
  const session = await requirePermission('cms:read');
  const canWrite = can(session.user.role, 'cms:write');

  const services = await db.service.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { translations: true },
  });

  const pick = (
    list: (typeof services)[number]['translations'],
    locale: 'ar' | 'en'
  ) => list.find((t) => t.locale === locale);

  return (
    <>
      <PageHeader
        title="الخدمات"
        description="محتوى الخدمات كما يظهر على الموقع — التعديل ينعكس فوراً بعد الحفظ"
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الصورة</Th>
              <Th>الاسم</Th>
              <Th>الرابط</Th>
              <Th>الوصف المختصر</Th>
              <Th>الإنجليزية</Th>
              <Th>الترتيب</Th>
              <Th>الحالة</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <EmptyState title="لا توجد خدمات" colSpan={8} />
            ) : (
              services.map((s) => {
                const ar = pick(s.translations, 'ar');
                const en = pick(s.translations, 'en');
                const migrated = !!MIGRATED_SERVICES[s.slug];

                return (
                  <Tr key={s.id}>
                    <Td>
                      {s.cardImage ? (
                        <Image
                          src={s.cardImage}
                          alt={ar?.name ?? s.slug}
                          width={56}
                          height={40}
                          className="rounded-md object-cover"
                          style={{ width: 56, height: 40 }}
                        />
                      ) : (
                        <span className="text-[11px] text-[var(--text-2)]">—</span>
                      )}
                    </Td>
                    <Td className="font-medium text-[var(--text-0)]">
                      {ar?.name ?? s.slug}
                      {ar?.tagline && (
                        <span className="block text-[11px] text-[var(--text-2)]">
                          {ar.tagline}
                        </span>
                      )}
                    </Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      <a
                        href={`/${s.slug}.html`}
                        target="_blank"
                        rel="noopener"
                        className="text-accent hover:underline"
                      >
                        /{s.slug}.html
                      </a>
                      {!migrated && (
                        <Badge className="ms-1.5">ثابتة</Badge>
                      )}
                    </Td>
                    <Td className="max-w-64 truncate text-[12px]" title={ar?.shortDesc ?? ''}>
                      {ar?.shortDesc ?? '—'}
                    </Td>
                    <Td>
                      {en?.name ? (
                        <Badge tone="ok">مترجمة</Badge>
                      ) : (
                        <Badge tone="warn">ناقصة</Badge>
                      )}
                    </Td>
                    <Td className="tnum">{s.sortOrder}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {s.isActive ? (
                          <Badge tone="ok">ظاهرة</Badge>
                        ) : (
                          <Badge tone="danger">مخفية</Badge>
                        )}
                        {s.showInNav && <Badge tone="accent">بالرئيسية</Badge>}
                      </div>
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center gap-0.5">
                          {migrated && (
                            <Link
                              href={`/dashboard/cms/services/${s.slug}`}
                              aria-label={`تحرير محتوى صفحة ${ar?.name ?? s.slug}`}
                              title="تحرير محتوى الصفحة"
                              className="inline-grid size-8 place-items-center rounded-[var(--radius-sm)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-accent"
                            >
                              <FileText className="size-4" />
                            </Link>
                          )}
                          <ServiceFormButton
                            service={{
                              id: s.id,
                              slug: s.slug,
                              cardImage: s.cardImage,
                              heroImage: s.heroImage,
                              sortOrder: s.sortOrder,
                              isActive: s.isActive,
                              showInNav: s.showInNav,
                              ar: {
                                name: ar?.name ?? '',
                                tagline: ar?.tagline,
                                shortDesc: ar?.shortDesc,
                                metaTitle: ar?.metaTitle,
                                metaDescription: ar?.metaDescription,
                              },
                              en: {
                                name: en?.name,
                                tagline: en?.tagline,
                                shortDesc: en?.shortDesc,
                                metaTitle: en?.metaTitle,
                                metaDescription: en?.metaDescription,
                              },
                            }}
                          />
                          <ToggleServiceButton id={s.id} isActive={s.isActive} />
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
