import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Car,
  CircleAlert,
  Droplets,
  LayoutGrid,
  Phone,
  Plus,
  ShieldCheck,
  StickyNote,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { backTo, withFrom } from '@/lib/back-link';
import { cn, formatDate } from '@/lib/utils';
import { RecordServiceButton } from '@/app/dashboard/customers/[id]/service-form';
import { VehicleFormButton } from '@/app/dashboard/customers/[id]/vehicle-form';
import {
  VEHICLE_WARRANTY_SELECT,
  mostUrgentService,
  parseLimit,
  vehicleHref,
  warrantyRows,
  type ProfilePerms,
} from '@/app/dashboard/_profile/data';
import {
  Info,
  ProfileTabs,
  Stat,
  TONE_TEXT,
  type ProfileTabItem,
} from '@/app/dashboard/_profile/parts';
import { WorkTab } from '@/app/dashboard/_profile/work-tab';
import { WashTab } from '@/app/dashboard/_profile/wash-tab';
import { loadVehicleAttention } from './attention';
import { VehicleOverviewTab } from './tab-overview';
import { VehicleWarrantiesTab } from './tab-warranties';

/*
  ملف السيارة: السيارة كيانٌ مستقل تُباع وتعود باسم آخر، فتاريخها كلّه
  يُقرأ هنا عبر ملّاكها — ما رُكّب عليها، وكفالاتها باسم من دفعها، ومن
  جاء بها في كل مرّة. أما المال فعلى أصحابه، في ملفّاتهم.
*/

type VehicleTab = 'overview' | 'work' | 'warranties' | 'wash';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vehicle = await db.vehicle.findUnique({
    where: { id },
    select: { make: true, model: true, plateNo: true },
  });
  if (!vehicle) return { title: 'السيارة' };
  return { title: `${vehicle.make} ${vehicle.model}${vehicle.plateNo ? ` — ${vehicle.plateNo}` : ''}` };
}

function single(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission('crm:read');
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const role = session.user.role;
  const perms: ProfilePerms = {
    write: can(role, 'crm:write'),
    remove: can(role, 'crm:delete'),
    workshop: can(role, 'workshop:read'),
    workshopWrite: can(role, 'workshop:write'),
    invoices: can(role, 'pos:read'),
    wash: can(role, 'wash:read'),
    washWrite: can(role, 'wash:write'),
  };
  const from = single(query.from);
  const now = new Date();

  const [vehicle, visits] = await Promise.all([
    db.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        color: true,
        paintCode: true,
        plateNo: true,
        notes: true,
        // المالك الحالي من حقل السيارة نفسه؛ سجلّ الملكية تاريخٌ يُعرض لا مصدرٌ يُخمَّن منه
        customer: { select: { id: true, name: true, phone: true, isBlocked: true } },
        ownerships: {
          orderBy: { from: 'desc' },
          select: { id: true, from: true, to: true, customer: { select: { id: true, name: true } } },
        },
        services: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
        warranties: { where: { isVoid: false }, select: VEHICLE_WARRANTY_SELECT },
        _count: {
          select: {
            bookings: true,
            jobOrders: perms.workshop,
            warranties: true,
            washSubscriptions: perms.wash,
          },
        },
      },
    }),
    perms.workshop
      ? db.jobOrder.aggregate({
          where: { vehicleId: id, status: { not: 'CANCELLED' } },
          _count: true,
          _max: { receivedAt: true },
        })
      : null,
  ]);

  if (!vehicle) notFound();

  const rows = warrantyRows(vehicle.warranties, vehicle.services[0]?.visitedAt ?? null, now);
  const urgent = mostUrgentService(rows);
  const attention = await loadVehicleAttention(vehicle.id, rows, perms, now);
  const carLabel = `${vehicle.make} ${vehicle.model}${vehicle.plateNo ? ` — ${vehicle.plateNo}` : ''}`;
  const owner = vehicle.customer;

  const tabs: ProfileTabItem[] = [
    { key: 'overview', label: 'نظرة عامة', icon: LayoutGrid, alert: attention.length },
    {
      key: 'work',
      label: perms.workshop ? 'الشغل والحجوزات' : 'الحجوزات',
      icon: Wrench,
      count: (perms.workshop ? vehicle._count.jobOrders : 0) + vehicle._count.bookings,
    },
    { key: 'warranties', label: 'الكفالات والسيرفس', icon: ShieldCheck, count: vehicle._count.warranties },
    ...(perms.wash
      ? [{ key: 'wash', label: 'الغسيل', icon: Droplets, count: vehicle._count.washSubscriptions }]
      : []),
  ];

  const requested = single(query.tab) ?? 'overview';
  const tab = (tabs.find((item) => item.key === requested)?.key ?? 'overview') as VehicleTab;
  const here = vehicleHref(vehicle.id, { tab: tab === 'overview' ? undefined : tab, from });
  const back = backTo(from, { href: '/dashboard/vehicles', label: 'العودة إلى السيارات' });
  const canRecordService = perms.write && Boolean(urgent);

  let content: React.ReactNode;
  switch (tab) {
    case 'work':
      content = (
        <WorkTab
          scope={{ vehicleId: vehicle.id }}
          here={here}
          hrefFor={(params) => vehicleHref(vehicle.id, { ...params, from })}
          perms={perms}
          blocked={owner.isBlocked}
          newJobHref={`/dashboard/job-orders/new?vehicle=${vehicle.id}`}
          type={single(query.type)}
          limit={parseLimit(query.limit)}
          now={now}
        />
      );
      break;
    case 'warranties':
      content = (
        <VehicleWarrantiesTab
          vehicleId={vehicle.id}
          ownerId={owner.id}
          carLabel={carLabel}
          here={here}
          perms={perms}
          now={now}
        />
      );
      break;
    case 'wash':
      content = <WashTab scope={{ vehicleId: vehicle.id }} here={here} perms={perms} />;
      break;
    default:
      content = (
        <VehicleOverviewTab
          vehicleId={vehicle.id}
          carLabel={carLabel}
          here={here}
          from={from}
          attention={attention}
          rows={rows}
          perms={perms}
          now={now}
        />
      );
  }

  return (
    <>
      <Link
        href={back.href}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
      >
        <ArrowRight className="size-4" />
        {back.label}
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] lg:sticky lg:top-24">
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"
              >
                <Car className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[17px] font-bold leading-snug text-[var(--text-0)]">
                  {vehicle.make} {vehicle.model}
                </h1>
                <p className="mt-1 text-[12px] text-[var(--text-2)]">
                  {[vehicle.year, vehicle.color].filter(Boolean).join(' · ') || '—'}
                </p>
                {/* كود اللون يُقرأ من البطاقة يوم تعود السيارة لصبغ — لا من فاتورةٍ قديمة */}
                {vehicle.paintCode && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                    كود اللون{' '}
                    <span className="tnum font-semibold text-[var(--text-0)]" dir="ltr">
                      {vehicle.paintCode}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* اللوحة هوية السيارة — تُقرأ من بعيد كما تُقرأ على السيارة */}
            <p
              className={cn(
                'mt-4 rounded-[var(--radius-sm)] border-2 border-[var(--line-strong)] py-2 text-center',
                vehicle.plateNo
                  ? 'tnum text-[20px] font-bold tracking-wider text-[var(--text-0)]'
                  : 'text-[12px] text-[var(--text-2)]'
              )}
              dir={vehicle.plateNo ? 'ltr' : undefined}
            >
              {vehicle.plateNo ?? 'بلا لوحة مسجّلة'}
            </p>

            <div className="mt-4 flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2.5">
              <UserRound className="size-4 shrink-0 text-[var(--text-2)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[var(--text-2)]">المالك الحالي</p>
                <Link
                  href={withFrom(`/dashboard/customers/${owner.id}`, here)}
                  className="block truncate text-[13px] font-semibold text-[var(--text-0)] hover:text-accent hover:underline"
                >
                  {owner.name}
                </Link>
              </div>
              {owner.isBlocked ? (
                <Badge tone="danger">محظور</Badge>
              ) : (
                <a
                  href={`tel:${owner.phone}`}
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                  aria-label={`اتصال بـ${owner.name}`}
                >
                  <Phone />
                </a>
              )}
            </div>

            {owner.isBlocked ? (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                مالكها محظور — لا يُنشأ لها بيان تشغيل جديد.
              </p>
            ) : (
              perms.workshopWrite && (
                /* السيارة تحمل مالكها: البيان يُفتح وعميلها وسيارتها معلَّمان */
                <Link
                  href={`/dashboard/job-orders/new?vehicle=${vehicle.id}`}
                  className={cn(buttonVariants({ size: 'md' }), 'mt-3 w-full')}
                >
                  <Plus />
                  بيان تشغيل جديد
                </Link>
              )
            )}

            {(canRecordService || perms.write) && (
              <div
                className={cn(
                  'mt-2 grid gap-2 [&_button]:w-full',
                  canRecordService && perms.write ? 'grid-cols-2' : 'grid-cols-1'
                )}
              >
                {canRecordService && (
                  <RecordServiceButton vehicleId={vehicle.id} label={carLabel} labelled />
                )}
                {perms.write && (
                  <VehicleFormButton
                    customerId={owner.id}
                    canDelete={perms.remove}
                    triggerVariant="secondary"
                    afterDeleteHref="/dashboard/vehicles"
                    vehicle={{
                      id: vehicle.id,
                      customerId: owner.id,
                      make: vehicle.make,
                      model: vehicle.model,
                      year: vehicle.year,
                      color: vehicle.color,
                      paintCode: vehicle.paintCode,
                      plateNo: vehicle.plateNo,
                      notes: vehicle.notes,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {(visits || urgent) && (
            <div className="grid grid-cols-2 border-t border-[var(--line)]">
              {visits && (
                <>
                  <Stat label="زيارات الورشة" value={String(visits._count)} className="border-e" />
                  <Stat label="آخر زيارة" value={formatDate(visits._max.receivedAt)} />
                </>
              )}
              {urgent && (
                <div className={cn('col-span-2 p-4', visits && 'border-t border-[var(--line)]')}>
                  <p className="text-[11px] text-[var(--text-2)]">السيرفس الدوري · كل {urgent.row.every} أشهر</p>
                  <p
                    className={cn(
                      'mt-1 text-[14px] font-bold',
                      TONE_TEXT[urgent.service.tone] ?? 'text-[var(--text-0)]'
                    )}
                  >
                    {urgent.service.label}
                  </p>
                  {urgent.service.dueAt && (
                    <p className="tnum mt-0.5 text-[11px] text-[var(--text-2)]">
                      الموعد {formatDate(urgent.service.dueAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(vehicle.ownerships.length > 0 || vehicle.notes) && (
            <dl className="space-y-3.5 border-t border-[var(--line)] p-5">
              {vehicle.ownerships.length > 0 && (
                <Info icon={Users} label={vehicle.ownerships.length > 1 ? `الملاك (${vehicle.ownerships.length})` : 'الملكية'}>
                  <ol className="space-y-2">
                    {vehicle.ownerships.map((ownership) => (
                      <li key={ownership.id}>
                        <Link
                          href={withFrom(`/dashboard/customers/${ownership.customer.id}`, here)}
                          className="font-medium text-[var(--text-0)] hover:text-accent hover:underline"
                        >
                          {ownership.customer.name}
                        </Link>
                        <span className="tnum block text-[11px] text-[var(--text-2)]">
                          {ownership.to
                            ? `${formatDate(ownership.from)} — ${formatDate(ownership.to)}`
                            : `منذ ${formatDate(ownership.from)}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Info>
              )}
              {vehicle.notes && (
                <Info icon={StickyNote} label="ملاحظات">
                  {vehicle.notes}
                </Info>
              )}
            </dl>
          )}
        </aside>

        <div className="min-w-0">
          <ProfileTabs
            label="أقسام ملف السيارة"
            tabs={tabs}
            active={tab}
            hrefFor={(key) => vehicleHref(vehicle.id, { tab: key === 'overview' ? undefined : key, from })}
          />
          {content}
        </div>
      </div>
    </>
  );
}
