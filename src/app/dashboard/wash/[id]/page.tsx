import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, Car, MapPin, UserRound } from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { withFrom } from '@/lib/back-link';
import { formatDateOnly, formatKWD, toNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AddPauseForm, DeletePauseButton } from './pause-controls';
import { ShareWashButton } from './share-button';
import { washLocationLine } from '@/app/dashboard/wash/location';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const VISIT_STATUS = {
  BLOCKED: { label: 'غير مسدّد', tone: 'muted' as const },
  PLANNED: { label: 'مخطّطة', tone: 'accent' as const },
  COMPLETED: { label: 'تمّت', tone: 'ok' as const },
  SKIPPED: { label: 'تعذّرت', tone: 'warn' as const },
};

const SKIP_REASON = {
  UNPAID: 'غير مسدّد',
  CAR_ABSENT: 'السيارة غير موجودة',
  CUSTOMER_TRAVEL: 'العميل مسافر',
  WEATHER: 'الطقس',
  HOLIDAY: 'عطلة رسمية',
  OPERATIONAL: 'سبب تشغيلي',
  OTHER: 'سبب آخر',
};

function completedTime(value: Date | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuwait',
  }).format(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const subscription = await db.washSubscription.findUnique({
    where: { id },
    select: { code: true },
  });
  return { title: subscription?.code ?? 'تفاصيل الاشتراك' };
}

export default async function WashSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('wash:read');
  const { id } = await params;
  const [subscription, visits] = await Promise.all([
    db.washSubscription.findUnique({
      where: { id },
      include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { make: true, model: true, year: true, plateNo: true } },
      pauses: { orderBy: [{ fromDate: 'desc' }, { createdAt: 'desc' }] },
      defaultWasher: { select: { fullName: true, code: true } },
      },
    }),
    db.washVisit.findMany({
      where: { period: { subscriptionId: id } },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take: 120,
      include: {
        assignedEmployee: { select: { fullName: true } },
        completedByEmployee: { select: { fullName: true } },
      },
    }),
  ]);
  if (!subscription) notFound();
  const defaultWasher = subscription?.defaultWasher ?? null;

  const canWrite = can(session.user.role, 'wash:write');
  const qrCodeSvg = canWrite && subscription.shareToken
    ? await qrSvg(`${siteUrl()}/w/${subscription.shareToken}`)
    : null;

  const status = {
    ACTIVE: { label: 'سارٍ', tone: 'ok' as const },
    PAUSED: { label: 'موقوف', tone: 'warn' as const },
    ENDED: { label: 'منتهٍ', tone: 'muted' as const },
  }[subscription.status];
  const here = `/dashboard/wash/${subscription.id}`;

  return (
    <>
      <Link
        href="/dashboard/wash"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        العودة إلى اشتراكات الغسيل
      </Link>

      <Card className="mb-5 overflow-hidden">
        <CardBody className="p-0">
          <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[12px] font-semibold text-accent">تفاصيل الاشتراك</p>
                <h1 className="tnum mt-1 text-2xl font-bold text-[var(--text-0)]" dir="ltr">
                  {subscription.code}
                </h1>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </div>
          <dl className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
            <Detail icon={<UserRound />} label="العميل">
              <Link
                href={withFrom(`/dashboard/customers/${subscription.customer.id}`, here)}
                className="font-semibold text-[var(--text-0)] hover:text-accent hover:underline"
              >
                {subscription.customer.name}
              </Link>
              <span className="tnum mt-1 block text-[12px] text-[var(--text-2)]" dir="ltr">
                {subscription.customer.phone}
              </span>
            </Detail>
            <Detail icon={<Car />} label="السيارة">
              {subscription.vehicle.make} {subscription.vehicle.model}
              {subscription.vehicle.year ? ` — ${subscription.vehicle.year}` : ''}
              <span className="tnum mt-1 block text-[12px] text-[var(--text-2)]" dir="ltr">
                {subscription.vehicle.plateNo ? `لوحة ${subscription.vehicle.plateNo}` : 'بلا لوحة مسجّلة'}
              </span>
            </Detail>
            <Detail icon={<MapPin />} label="موقع الخدمة">
              {washLocationLine(subscription)}
              {subscription.locationNotes && (
                <span className="mt-1 block text-[12px] text-[var(--text-2)]">
                  {subscription.locationNotes}
                </span>
              )}
            </Detail>
            <Detail icon={<CalendarDays />} label="الاشتراك الشهري">
              <span className="tnum font-semibold text-[var(--text-0)]">
                {formatKWD(toNumber(subscription.monthlyPrice))}
              </span>
            </Detail>
            <Detail icon={<UserRound />} label="الغسّيل المعتاد">
              {defaultWasher
                ? `${defaultWasher.fullName} — ${defaultWasher.code}`
                : 'غير محدد'}
            </Detail>
          </dl>
        </CardBody>
      </Card>

      {canWrite && (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <CardTitle>بطاقة العميل</CardTitle>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">
                رابط متابعة الغسلات الخاص بالعميل لمشاركته عبر الواتساب أو مسحه من الرمز.
              </p>
            </div>
            <ShareWashButton subscriptionId={subscription.id} />
          </CardHeader>
          {qrCodeSvg && (
            <CardBody className="border-t border-[var(--line)] pt-4">
              <div className="flex items-center gap-4">
                <div
                  className="size-24 shrink-0 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-1.5 [&_svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-0)]">رمز الاستجابة السريعة (QR)</p>
                  <p className="mt-1 text-[12px] text-[var(--text-2)]">
                    يمكن للعميل مسح هذا الرمز مباشرة لمتابعة حالة اشتراكه وغسلاته.
                  </p>
                </div>
              </div>
            </CardBody>
          )}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>الإيقافات</CardTitle>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">
                الأيام القادمة داخل الفترة تُعلَّم «العميل مسافر» ولا تُفتح عند الدفع.
              </p>
            </div>
            <Badge tone="neutral">{subscription.pauses.length}</Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            {canWrite && <AddPauseForm subscriptionId={subscription.id} />}
            {subscription.pauses.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-[var(--text-2)]">لا توجد إيقافات مسجّلة.</p>
            ) : (
              <ul className="space-y-2">
                {subscription.pauses.map((pause) => (
                  <li key={pause.id} className="rounded-[var(--radius-md)] border border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="tnum text-[13px] font-semibold text-[var(--text-0)]">
                          {formatDateOnly(pause.fromDate)} — {formatDateOnly(pause.toDate)}
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--text-2)]">
                          {pause.reason || 'بدون سبب مكتوب'}
                        </p>
                      </div>
                      {canWrite && <DeletePauseButton pauseId={pause.id} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>سجل الغسلات</CardTitle>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">أحدث 120 غسلة، الأحدث أولاً.</p>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table className="min-w-[760px]">
                <thead>
                  <tr>
                    <Th>التاريخ</Th>
                    <Th>الحالة</Th>
                    <Th>السبب</Th>
                    <Th>الغسّيل</Th>
                    <Th>وقت الإتمام</Th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 ? (
                    <EmptyState title="لا توجد غسلات بعد" colSpan={5} />
                  ) : (
                    visits.map((visit) => {
                      const visitStatus = VISIT_STATUS[visit.status];
                      return (
                        <Tr key={visit.id}>
                          <Td className="tnum whitespace-nowrap">{formatDateOnly(visit.scheduledDate)}</Td>
                          <Td><Badge tone={visitStatus.tone}>{visitStatus.label}</Badge></Td>
                          <Td>{visit.skipReason ? SKIP_REASON[visit.skipReason] : '—'}</Td>
                          <Td>{visit.completedByEmployee?.fullName ?? visit.assignedEmployee?.fullName ?? '—'}</Td>
                          <Td className="tnum whitespace-nowrap text-[12px]">{completedTime(visit.completedAt)}</Td>
                        </Tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface-1)] p-5">
      <dt className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--text-2)] [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="text-[13px] leading-6 text-[var(--text-1)]">{children}</dd>
    </div>
  );
}
