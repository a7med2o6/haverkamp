import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/guard';
import { toNumber } from '@/lib/utils';
import { PROTECTION_BRAND_SLUGS } from '@/lib/intake';
import { IntakeForm } from './intake-form';

export const metadata: Metadata = { title: 'بيان تشغيل جديد' };
export const dynamic = 'force-dynamic';

export default async function NewIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  await requirePermission('workshop:write');
  const { booking: bookingId } = await searchParams;

  const [customers, brands] = await Promise.all([
    db.customer.findMany({
      where: { isBlocked: false },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, phone: true },
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

  /*
    الحجز يملأ البيان ولا يُنشئ الأمر: القادم من «تحويل إلى أمر شغل» يجد
    عميله وسيارته وخدمته جاهزة، ويُكمل ما لا يعرفه الحجزُ — الرقم الورقي
    والباقة ودرجة العزل والسعر.
  */
  const booking = bookingId
    ? await db.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          code: true,
          customerId: true,
          vehicleId: true,
          serviceKey: true,
          serviceSpec: true,
          service: {
            include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
          },
          notes: true,
          jobOrder: { select: { id: true } },
        },
      })
    : null;

  // حجز حُوّل سلفاً لا يُحوَّل ثانيةً
  if (booking?.jobOrder) redirect(`/dashboard/job-orders/${booking.jobOrder.id}`);

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
        booking={
          booking
            ? {
                id: booking.id,
                code: booking.code,
                customerId: booking.customerId,
                vehicleId: booking.vehicleId,
                serviceKey: booking.serviceKey,
                serviceSpec: booking.serviceSpec,
                serviceName: booking.service?.translations[0]?.name ?? null,
                notes: booking.notes,
              }
            : null
        }
        customers={customers}
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
