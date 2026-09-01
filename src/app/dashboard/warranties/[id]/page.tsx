import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { backTo, withFrom } from '@/lib/back-link';
import {
  SERVICE_GRACE_DAYS,
  serviceStatus,
  warrantyLabel,
  warrantyPartLabels,
} from '@/lib/intake';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { expiryStatus, formatDate } from '@/lib/utils';
import { PrintButton } from '@/app/dashboard/invoices/[id]/print-button';
import { VoidWarrantyButton } from '../warranty-client';
import { DeleteServiceButton } from '@/app/dashboard/customers/[id]/service-form';

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** من أين جاء الزائر — ليعود إليه لا إلى قائمة القسم */
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requirePermission('crm:read');
  const { id } = await params;
  const back = backTo((await searchParams).from, {
    href: '/dashboard/warranties',
    label: 'العودة إلى الكفالات',
  });

  const [warranty, settings] = await Promise.all([
    db.warranty.findUnique({
      where: { id },
      include: {
        vehicle: {
          include: {
            customer: true,
            // زيارات السيارة كلّها — والتصفية بتاريخ بداية الكفالة بعد القراءة
            services: {
              orderBy: { visitedAt: 'desc' },
              include: { user: { select: { name: true } } },
            },
          },
        },
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
  const parts = warrantyPartLabels(warranty.parts);

  /*
    زيارة سبقت الكفالة لا تُحسب لها — كانت لسيارة لم تُكفل بعد. ونعرض ما
    يُحسب فقط، فعرض زياراتٍ لا أثر لها يوهم بالتزامٍ لم يقع.
  */
  const visits = warranty.vehicle.services.filter((v) => v.visitedAt > warranty.startDate);
  const service = serviceStatus(warranty, visits[0]?.visitedAt ?? null);
  const canWrite = can(session.user.role, 'crm:write');
  const months = Math.round(
    (warranty.endDate.getTime() - warranty.startDate.getTime()) / (30.44 * 86400000)
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
        >
          <ArrowRight className="size-4" />
          {back.label}
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
                {warrantyLabel(warranty)}
              </Info>

              {/*
                ما تغطّيه الشهادة.
                شهادةٌ لا تذكر أجزاءها تغطّي الموضوع كلّه، وشهادةُ جزءٍ
                استُبدل بعد حادثٍ تذكره وحده — ولولا ذكرُه لادّعت تغطيةَ
                بدنٍ لم تركّبه.
              */}
              <Info label="النطاق">
                {parts.length === 0 ? (
                  'كامل'
                ) : (
                  <span>
                    <span className="tnum">{parts.length}</span>{' '}
                    {parts.length === 2 ? 'جزآن' : 'أجزاء'} — {parts.join('، ')}
                  </span>
                )}
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

              {warranty.jobOrder && (
                <Info label="أمر الشغل">
                  <Link
                    href={withFrom(`/dashboard/job-orders/${warranty.jobOrder.id}`, `/dashboard/warranties/${warranty.id}`)}
                    className="tnum text-accent hover:underline print:text-[var(--text-0)]"
                    dir="ltr"
                  >
                    {warranty.jobOrder.number}
                  </Link>
                </Info>
              )}
            </div>

            {/*
              شرط السيرفس الدوري.
              الكفالة الطويلة مشروطة، والشرط يُطبع على الشهادة لأن العميل
              يوقّع عليها — فلا يُقال له بعد سنتين «كان عليك سيرفس» ولم يكن
              مكتوباً أمامه.
            */}
            {service.required && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 print:break-inside-avoid">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[var(--text-2)]">
                    السيرفس الدوري — كل{' '}
                    <span className="tnum">{warranty.serviceEveryMonths}</span> أشهر
                  </p>
                  <div className="print:hidden">
                    <Badge tone={service.tone}>{service.label}</Badge>
                  </div>
                </div>

                <p className="text-[12px] leading-relaxed text-[var(--text-1)]">
                  تسقط هذه الكفالة إن انقطع صاحبها عن السيرفس الدوري. ومهلة السماح{' '}
                  <span className="tnum">{SERVICE_GRACE_DAYS}</span> يوماً بعد كل موعد.
                </p>

                <div className="mt-2 grid gap-1 text-[12px] text-[var(--text-2)] print:hidden">
                  <p>
                    آخر زيارة:{' '}
                    <span className="tnum text-[var(--text-1)]">
                      {visits[0] ? formatDate(visits[0].visitedAt) : 'لم يزر بعد'}
                    </span>
                  </p>
                  {service.dueAt && (
                    <p>
                      الموعد القادم:{' '}
                      <span className="tnum text-[var(--text-1)]">{formatDate(service.dueAt)}</span>
                      {service.deadline && (
                        <>
                          {' '}— بمهلة حتى{' '}
                          <span className="tnum text-[var(--text-1)]">
                            {formatDate(service.deadline)}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>

                {visits.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3 print:hidden">
                    {visits.map((v) => (
                      <li key={v.id} className="flex items-start justify-between gap-2 text-[12px]">
                        <div>
                          <span className="tnum text-[var(--text-1)]">
                            {formatDate(v.visitedAt)}
                          </span>
                          {v.user?.name && (
                            <span className="text-[var(--text-2)]"> · {v.user.name}</span>
                          )}
                          {v.notes && (
                            <p className="text-[11px] leading-relaxed text-[var(--text-2)]">
                              {v.notes}
                            </p>
                          )}
                        </div>
                        {canWrite && <DeleteServiceButton id={v.id} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
