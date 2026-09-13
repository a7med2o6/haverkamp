import Link from 'next/link';
import type { Metadata } from 'next';
import { Info, Lock } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/dashboard/page-header';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PROTECTION_BRAND_SLUGS } from '@/lib/intake';
import { formatKWD, toNumber } from '@/lib/utils';
import { DeletePackageButton, PackageFormButton, TogglePackageButton } from './package-form';

export const metadata: Metadata = { title: 'الباقات والأسعار' };
export const dynamic = 'force-dynamic';

export default async function PackagesPage() {
  const session = await requirePermission('cms:read');
  const canWrite = can(session.user.role, 'cms:write');

  const services = await db.service.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      translations: { where: { locale: 'ar' }, select: { name: true } },
      packages: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          translations: { select: { locale: true, name: true, features: true } },
          _count: { select: { washSubscriptions: true } },
        },
      },
    },
  });

  const withPackages = services.filter((service) => service.packages.length > 0);
  const withoutPackages = services.filter((service) => service.packages.length === 0);
  const protection = new Set<string>(PROTECTION_BRAND_SLUGS);

  return (
    <>
      <PageHeader
        title="الباقات والأسعار"
        description="أسعار النظام — تُقترح في اشتراكات الغسيل وفي بيان التشغيل"
      />

      {/*
        الموقع العام لا يقرأ هذا الجدول: أسعار صفحاته نصوصٌ مستقلة. فتعديل سعرٍ
        هنا لا يغيّر ما يراه الزائر، ويُقال ذلك صراحةً قبل أن يُفترض العكس.
      */}
      <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3 text-[13px] text-[var(--text-1)]">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>
          تعديل السعر هنا لا يغيّر الأسعار المعروضة على صفحات الموقع — تلك تُعدَّل من{' '}
          <Link href="/dashboard/cms/translations" className="text-accent hover:underline">
            كل النصوص
          </Link>
          . ولا يُعيد تسعير اشتراكٍ قائم؛ يُقترح السعر الجديد للاشتراكات الجديدة فقط.
        </p>
      </div>

      <div className="space-y-6">
        {withPackages.map((service) => {
          const serviceName = service.translations[0]?.name ?? service.slug;
          const locked = protection.has(service.slug);

          return (
            <section key={service.id} aria-labelledby={`svc-${service.id}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`svc-${service.id}`} className="text-base font-semibold text-[var(--text-0)]">
                    {serviceName}
                  </h2>
                  <span className="tnum text-[12px] text-[var(--text-2)]">{service.packages.length} باقة</span>
                  {!service.isActive && <Badge tone="muted">الخدمة مخفية</Badge>}
                  {locked && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-2)]">
                      <Lock className="size-3.5" />
                      الأسماء ثابتة — بيان التشغيل يطابق عليها
                    </span>
                  )}
                </div>
                {canWrite && (
                  <PackageFormButton serviceId={service.id} serviceName={serviceName} nameLocked={locked} />
                )}
              </div>

              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>الباقة</Th>
                      <Th>السعر</Th>
                      <Th>الترتيب</Th>
                      <Th>الحالة</Th>
                      <Th>الاستخدام</Th>
                      {canWrite && <Th />}
                    </tr>
                  </thead>
                  <tbody>
                    {service.packages.map((pkg) => {
                      const ar = pkg.translations.find((t) => t.locale === 'ar');
                      const en = pkg.translations.find((t) => t.locale === 'en');
                      const name = ar?.name ?? '—';
                      const linked = pkg._count.washSubscriptions;
                      const price = toNumber(pkg.price);

                      return (
                        <Tr key={pkg.id} className={pkg.isActive ? undefined : 'opacity-60'}>
                          <Td>
                            <div className="font-medium text-[var(--text-0)]">{name}</div>
                            {en?.name && (
                              <div className="text-[12px] text-[var(--text-2)]" dir="ltr">
                                {en.name}
                              </div>
                            )}
                          </Td>
                          <Td className="tnum whitespace-nowrap">
                            {pkg.priceFrom && (
                              <span className="me-1 text-[12px] text-[var(--text-2)]">يبدأ من</span>
                            )}
                            <span className="font-semibold text-[var(--text-0)]">{formatKWD(price)}</span>
                          </Td>
                          <Td className="tnum">{pkg.sortOrder}</Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              <Badge tone={pkg.isActive ? 'ok' : 'muted'}>{pkg.isActive ? 'مفعّلة' : 'موقوفة'}</Badge>
                              {pkg.isPopular && <Badge tone="accent">الأكثر طلباً</Badge>}
                            </div>
                          </Td>
                          <Td className="tnum text-[12px] text-[var(--text-1)]">
                            {linked > 0 ? `${linked} اشتراك غسيل` : '—'}
                          </Td>
                          {canWrite && (
                            <Td>
                              <div className="flex items-center justify-end gap-1">
                                <PackageFormButton
                                  serviceId={service.id}
                                  serviceName={serviceName}
                                  nameLocked={locked}
                                  pkg={{
                                    id: pkg.id,
                                    serviceId: service.id,
                                    nameAr: ar?.name ?? '',
                                    nameEn: en?.name ?? '',
                                    price: price.toFixed(3),
                                    priceFrom: pkg.priceFrom,
                                    duration: pkg.duration ?? '',
                                    warranty: pkg.warranty ?? '',
                                    sortOrder: String(pkg.sortOrder),
                                    isActive: pkg.isActive,
                                    isPopular: pkg.isPopular,
                                    features: (ar?.features ?? []).join('\n'),
                                  }}
                                />
                                <TogglePackageButton id={pkg.id} isActive={pkg.isActive} name={name} />
                                {/* الحماية وما ارتبط باشتراك يُوقَف ولا يُحذف — والخادم يرفض أيضاً */}
                                {!locked && linked === 0 && <DeletePackageButton id={pkg.id} name={name} />}
                              </div>
                            </Td>
                          )}
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </section>
          );
        })}

        {canWrite && withoutPackages.length > 0 && (
          <section aria-labelledby="svc-empty">
            <h2 id="svc-empty" className="mb-2 text-base font-semibold text-[var(--text-0)]">
              خدمات بلا باقات
            </h2>
            <div className="divide-y divide-[var(--line)] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
              {withoutPackages.map((service) => {
                const serviceName = service.translations[0]?.name ?? service.slug;
                return (
                  <div key={service.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm text-[var(--text-1)]">{serviceName}</span>
                    <PackageFormButton
                      serviceId={service.id}
                      serviceName={serviceName}
                      nameLocked={protection.has(service.slug)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
