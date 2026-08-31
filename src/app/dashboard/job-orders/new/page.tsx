import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { toNumber } from '@/lib/utils';
import { PROTECTION_BRAND_SLUGS } from '@/lib/intake';
import { IntakeForm } from './intake-form';

export const metadata: Metadata = { title: 'بيان تشغيل جديد' };
export const dynamic = 'force-dynamic';

export default async function NewIntakePage() {
  await requirePermission('workshop:write');

  const [customers, brands] = await Promise.all([
    db.customer.findMany({
      where: { isBlocked: false },
      orderBy: { name: 'asc' },
      take: 500,
      select: {
        id: true,
        name: true,
        phone: true,
        vehicles: { select: { id: true, make: true, model: true, plateNo: true } },
      },
    }),
    // ماركات الحماية تحمل الباقات والأسعار — تُقرأ ولا تُكتب في الكتالوج
    db.service.findMany({
      where: { slug: { in: [...PROTECTION_BRAND_SLUGS] }, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: { where: { locale: 'ar' }, select: { name: true } },
        packages: {
          where: { isActive: true },
          include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
        },
      },
    }),
  ]);

  return (
    <>
      <Link
        href="/dashboard/job-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى أوامر الشغل
      </Link>

      <IntakeForm
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          vehicles: c.vehicles.map((v) => ({
            id: v.id,
            label: `${v.make} ${v.model}${v.plateNo ? ` — ${v.plateNo}` : ''}`,
          })),
        }))}
        brands={brands.map((b) => ({
          id: b.id,
          name: b.translations[0]?.name ?? b.slug,
          packages: b.packages.map((p) => ({
            name: p.translations[0]?.name ?? '',
            price: toNumber(p.price),
          })),
        }))}
      />
    </>
  );
}
