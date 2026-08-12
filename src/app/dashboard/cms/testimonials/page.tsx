import Image from 'next/image';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DeleteTestimonialButton, TestimonialFormButton } from './testimonial-client';

export const metadata: Metadata = { title: 'آراء العملاء' };
export const dynamic = 'force-dynamic';

export default async function CmsTestimonialsPage() {
  const session = await requirePermission('cms:read');
  const canWrite = can(session.user.role, 'cms:write');
  const canDelete = can(session.user.role, 'cms:delete');

  const items = await db.testimonial.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  const published = items.filter((t) => t.isActive).length;

  return (
    <>
      <PageHeader
        title="آراء العملاء"
        description={
          published === 0
            ? 'لا يوجد رأي منشور — الموقع يعرض الآراء الافتراضية حتى تُضيف أول رأي'
            : `${published} رأي منشور في الصفحة الرئيسية`
        }
        actions={canWrite && <TestimonialFormButton />}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>العميل</Th>
              <Th>الرأي</Th>
              <Th>الإنجليزية</Th>
              <Th>التقييم</Th>
              <Th>الترتيب</Th>
              <Th>الحالة</Th>
              {(canWrite || canDelete) && <Th />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyState title="لا توجد آراء بعد" colSpan={7} />
            ) : (
              items.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      {t.avatar ? (
                        <Image
                          src={t.avatar}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded-full object-cover"
                          style={{ width: 32, height: 32 }}
                        />
                      ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--glass-strong)] text-[12px] font-bold text-[var(--text-1)]">
                          {t.author.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="block font-medium text-[var(--text-0)]">
                          {t.author}
                        </span>
                        {t.carModel && (
                          <span className="block text-[11px] text-[var(--text-2)]">
                            {t.carModel}
                          </span>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="max-w-80 truncate text-[12px]" title={t.bodyAr}>
                    {t.bodyAr}
                  </Td>
                  <Td>
                    {t.bodyEn ? <Badge tone="ok">مترجم</Badge> : <Badge tone="warn">ناقص</Badge>}
                  </Td>
                  <Td className="text-accent" title={`${t.rating} من 5`}>
                    {'★'.repeat(t.rating)}
                  </Td>
                  <Td className="tnum">{t.sortOrder}</Td>
                  <Td>
                    {t.isActive ? (
                      <Badge tone="ok">منشور</Badge>
                    ) : (
                      <Badge tone="danger">مخفي</Badge>
                    )}
                  </Td>
                  {(canWrite || canDelete) && (
                    <Td>
                      <div className="flex items-center gap-0.5">
                        {canWrite && (
                          <TestimonialFormButton
                            item={{
                              id: t.id,
                              author: t.author,
                              avatar: t.avatar,
                              rating: t.rating,
                              bodyAr: t.bodyAr,
                              bodyEn: t.bodyEn,
                              carModel: t.carModel,
                              sortOrder: t.sortOrder,
                              isActive: t.isActive,
                            }}
                          />
                        )}
                        {canDelete && (
                          <DeleteTestimonialButton id={t.id} author={t.author} />
                        )}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
