import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { expiryStatus, formatDate } from '@/lib/utils';
import { PrintButton } from '@/app/dashboard/invoices/[id]/print-button';
import { VoidWarrantyButton } from '../warranty-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const warranty = await db.warranty.findUnique({
    where: { id },
    select: { certificateNo: true },
  });
  return { title: warranty?.certificateNo ?? 'شهادة كفالة' };
}

export default async function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('crm:read');
  const { id } = await params;

  const [warranty, settings] = await Promise.all([
    db.warranty.findUnique({
      where: { id },
      include: {
        vehicle: { include: { customer: true } },
        service: { include: { translations: { where: { locale: 'ar' }, select: { name: true } } } },
        jobOrder: { select: { id: true, number: true, deliveredAt: true } },
      },
    }),
    db.siteSetting.findMany({
      where: { key: { in: ['contact.address.ar', 'contact.phone', 'pos.receiptFooter.ar'] } },
    }),
  ]);

  if (!warranty) notFound();

  const setting = (key: string) =>
    (settings.find((s) => s.key === key)?.value as string | undefined) ?? '';

  const status = expiryStatus(warranty.endDate);
  const canWrite = can(session.user.role, 'crm:write');
  const months = Math.round(
    (warranty.endDate.getTime() - warranty.startDate.getTime()) / (30.44 * 86400000)
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/warranties"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          العودة إلى الكفالات
        </Link>
        <div className="flex items-center gap-2">
          {canWrite && (
            <VoidWarrantyButton
              id={warranty.id}
              certificateNo={warranty.certificateNo}
              isVoid={warranty.isVoid}
            />
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="flex-col items-center gap-1 text-center">
            <CardTitle className="text-lg">هافركامب الكويت</CardTitle>
            <p className="text-[12px] text-[var(--text-2)]">{setting('contact.address.ar')}</p>
            <p className="tnum text-[12px] text-[var(--text-2)]" dir="ltr">
              {setting('contact.phone')}
            </p>
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="border-b border-[var(--line)] pb-4 text-center">
              <p className="text-[13px] font-semibold text-accent-soft">شهادة كفالة</p>
              <p className="tnum mt-1 text-xl font-bold text-[var(--text-0)]" dir="ltr">
                {warranty.certificateNo}
              </p>
              <div className="mt-2 flex justify-center">
                {warranty.isVoid ? (
                  <Badge tone="danger">ملغاة</Badge>
                ) : (
                  <Badge tone={status.tone === 'neutral' ? 'neutral' : status.tone}>
                    {status.label}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 text-[13px] sm:grid-cols-2">
              <Info label="العميل">
                <span className="font-medium text-[var(--text-0)]">
                  {warranty.vehicle.customer.name}
                </span>
                <span className="tnum block text-[12px] text-[var(--text-2)]" dir="ltr">
                  {warranty.vehicle.customer.phone}
                </span>
              </Info>

              <Info label="السيارة">
                {warranty.vehicle.make} {warranty.vehicle.model}
                {warranty.vehicle.year ? ` — ${warranty.vehicle.year}` : ''}
                {warranty.vehicle.plateNo && (
                  <span className="tnum block text-[12px] text-[var(--text-2)]" dir="ltr">
                    لوحة {warranty.vehicle.plateNo}
                  </span>
                )}
              </Info>

              <Info label="الخدمة المكفولة">
                {warranty.service?.translations[0]?.name ?? 'كفالة عامة'}
              </Info>

              <Info label="مدة الكفالة">
                <span className="tnum">{months} شهر</span>
              </Info>

              <Info label="تاريخ البداية">
                <span className="tnum">{formatDate(warranty.startDate)}</span>
              </Info>

              <Info label="تاريخ الانتهاء">
                <span className="tnum font-semibold text-[var(--text-0)]">
                  {formatDate(warranty.endDate)}
                </span>
              </Info>

              {warranty.vehicle.vin && (
                <Info label="رقم الهيكل">
                  <span className="tnum" dir="ltr">
                    {warranty.vehicle.vin}
                  </span>
                </Info>
              )}

              {warranty.jobOrder && (
                <Info label="أمر الشغل">
                  <Link
                    href={`/dashboard/job-orders/${warranty.jobOrder.id}`}
                    className="tnum text-accent hover:underline print:text-[var(--text-0)]"
                    dir="ltr"
                  >
                    {warranty.jobOrder.number}
                  </Link>
                </Info>
              )}
            </div>

            {warranty.terms && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="mb-1.5 text-[11px] font-semibold text-[var(--text-2)]">
                  بنود الكفالة
                </p>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">
                  {warranty.terms}
                </p>
              </div>
            )}

            <div className="grid gap-6 border-t border-[var(--line)] pt-6 text-center text-[12px] text-[var(--text-2)] sm:grid-cols-2">
              <div>
                <div className="mb-1 border-b border-dashed border-[var(--line-strong)] pb-8" />
                توقيع العميل
              </div>
              <div>
                <div className="mb-1 border-b border-dashed border-[var(--line-strong)] pb-8" />
                توقيع المسؤول
              </div>
            </div>

            <p className="text-center text-[12px] text-[var(--text-2)]">
              {setting('pos.receiptFooter.ar')}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <div className="text-[var(--text-1)]">{children}</div>
    </div>
  );
}
