import Image from 'next/image';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { GALLERY_SLOTS } from '@/lib/constants';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { DeleteGalleryButton, GalleryFormButton } from './gallery-client';

export const metadata: Metadata = { title: 'معرض الصور' };
export const dynamic = 'force-dynamic';

export default async function CmsGalleryPage() {
  const session = await requirePermission('cms:read');
  const canWrite = can(session.user.role, 'cms:write');
  const canDelete = can(session.user.role, 'cms:delete');

  const [items, services] = await Promise.all([
    db.galleryItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { service: { include: { translations: { where: { locale: 'ar' } } } } },
    }),
    db.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: 'ar' } } },
    }),
  ]);

  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: s.translations[0]?.name ?? s.slug,
  }));

  const featured = items.filter((g) => g.isActive && g.isFeatured).length;

  // شبكة الرئيسية تتّسع لخمس صور فقط — الباقي لا يظهر، ولا فائدة من إخفاء ذلك
  const shown = Math.min(featured, GALLERY_SLOTS);

  // نفس ترتيب getFeaturedGallery — حتى نُعلّم الصور التي فاض عنها المكان
  const onHome = new Set(
    items
      .filter((g) => g.isActive && g.isFeatured)
      .slice(0, GALLERY_SLOTS)
      .map((g) => g.id)
  );

  return (
    <>
      <PageHeader
        title="معرض الصور"
        description={
          featured > GALLERY_SLOTS
            ? `تظهر أول ${GALLERY_SLOTS} صور مميّزة (حسب الترتيب) في معرض الصفحة الرئيسية — لديك ${featured} صورة مميّزة، الباقي لن يظهر`
            : `الصور المميّزة تظهر في قسم «معرض أعمالنا» بالصفحة الرئيسية — ${shown} من ${GALLERY_SLOTS} خانات`
        }
        actions={canWrite && <GalleryFormButton services={serviceOptions} />}
      />

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] p-12 text-center">
          <p className="text-sm text-[var(--text-1)]">لا توجد صور في المعرض بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            أضف صوراً من أعمالكم لتظهر في الصفحة الرئيسية
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((g) => (
            <div
              key={g.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]"
            >
              <div className="relative aspect-[16/11] bg-[var(--glass)]">
                <Image
                  src={g.imageUrl}
                  alt={g.captionAr ?? ''}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                />
                {!g.isActive && (
                  <div className="absolute inset-0 grid place-items-center bg-black/55">
                    <Badge tone="danger">موقوفة</Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2 p-3">
                <p className="truncate text-[13px] font-medium text-[var(--text-0)]">
                  {g.captionAr || <span className="text-[var(--text-2)]">بلا وصف</span>}
                </p>
                <p className="truncate text-[11px] text-[var(--text-2)]" dir="ltr">
                  {g.captionEn || '—'}
                </p>

                <div className="flex flex-wrap items-center gap-1">
                  {g.isFeatured &&
                    (onHome.has(g.id) ? (
                      <Badge tone="accent">بالرئيسية</Badge>
                    ) : (
                      <Badge tone="warn">خارج الشبكة</Badge>
                    ))}
                  {g.service && (
                    <Badge>{g.service.translations[0]?.name ?? g.service.slug}</Badge>
                  )}
                  <span className="tnum text-[11px] text-[var(--text-2)]">#{g.sortOrder}</span>
                </div>

                {(canWrite || canDelete) && (
                  <div className="flex items-center justify-end gap-0.5 border-t border-[var(--line)] pt-2">
                    {canWrite && (
                      <GalleryFormButton
                        services={serviceOptions}
                        item={{
                          id: g.id,
                          imageUrl: g.imageUrl,
                          captionAr: g.captionAr,
                          captionEn: g.captionEn,
                          serviceId: g.serviceId,
                          sortOrder: g.sortOrder,
                          isActive: g.isActive,
                          isFeatured: g.isFeatured,
                        }}
                      />
                    )}
                    {canDelete && <DeleteGalleryButton id={g.id} />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
