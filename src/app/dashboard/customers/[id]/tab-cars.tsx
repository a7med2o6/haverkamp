import Link from 'next/link';
import { Car, ChevronDown, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { withFrom } from '@/lib/back-link';
import { cn, formatDate } from '@/lib/utils';
import {
  VEHICLE_WARRANTY_SELECT,
  customerHref,
  mostUrgentFirst,
  warrantyRows,
  type ProfilePerms,
} from '@/app/dashboard/_profile/data';
import { IconTile, Plate, TONE_TEXT } from '@/app/dashboard/_profile/parts';
import { RecordServiceButton } from './service-form';
import { VehicleFormButton } from './vehicle-form';

/** سيارات العميل الأساطيل تتجاوز العشر؛ خمسٌ تُرى والباقي بطلب */
const VISIBLE_CARS = 5;

export async function CarsTab({
  customerId,
  here,
  from,
  perms,
  showAll,
  now,
}: {
  customerId: string;
  here: string;
  from?: string;
  perms: ProfilePerms;
  showAll: boolean;
  now: Date;
}) {
  const [vehicles, ownerships, washing] = await Promise.all([
    db.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        color: true,
        paintCode: true,
        plateNo: true,
        notes: true,
        services: { orderBy: { visitedAt: 'desc' }, take: 3, select: { id: true, visitedAt: true } },
        warranties: {
          // الكفالة لا تنتقل مع بيع السيارة (انظر Warranty في المخطط) — تُعرض لمن دفعها وحده
          where: { customerId, isVoid: false },
          orderBy: { endDate: 'desc' },
          select: VEHICLE_WARRANTY_SELECT,
        },
      },
    }),
    db.vehicleOwnership.findMany({
      where: { customerId, to: { not: null } },
      orderBy: { to: 'desc' },
      select: {
        id: true,
        vehicleId: true,
        to: true,
        vehicle: {
          select: { make: true, model: true, plateNo: true, customer: { select: { name: true } } },
        },
      },
    }),
    perms.wash
      ? db.washSubscription.findMany({
          where: { customerId, status: { not: 'ENDED' } },
          select: { vehicleId: true },
        })
      : [],
  ]);

  const washed = new Set(washing.map((subscription) => subscription.vehicleId));
  const previous = ownerships.filter(
    (ownership, index, all) => all.findIndex((item) => item.vehicleId === ownership.vehicleId) === index
  );

  // الأحوج إلى تصرّف أولاً: من فات سيرفسه لا يُدفن تحت سيارة سليمة أُضيفت بعده
  const cars = vehicles
    .map((vehicle) => ({
      id: vehicle.id,
      vehicle,
      rows: warrantyRows(vehicle.warranties, vehicle.services[0]?.visitedAt ?? null, now),
    }))
    .sort(mostUrgentFirst);
  const visible = showAll ? cars : cars.slice(0, VISIBLE_CARS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-2)]">
          {vehicles.length === 0
            ? 'لا توجد سيارة مسجّلة لهذا العميل.'
            : `${vehicles.length} ${vehicles.length === 1 ? 'سيارة حالية' : 'سيارات حالية'}${vehicles.length > 1 ? ' · الأحوج للسيرفس أولاً' : ''}`}
        </p>
        {perms.write && <VehicleFormButton customerId={customerId} />}
      </div>

      {visible.map(({ vehicle, rows }) => {
        const label = `${vehicle.make} ${vehicle.model}${vehicle.plateNo ? ` — ${vehicle.plateNo}` : ''}`;
        const conditional = rows.find((row) => row.service);

        return (
          <section
            key={vehicle.id}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
              <IconTile icon={Car} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-[var(--text-0)]">
                    <Link
                      href={withFrom(`/dashboard/vehicles/${vehicle.id}`, here)}
                      className="hover:text-accent hover:underline"
                    >
                      {vehicle.make} {vehicle.model}
                    </Link>
                  </h3>
                  <Plate value={vehicle.plateNo} />
                  {washed.has(vehicle.id) && <Badge tone="info">اشتراك غسيل</Badge>}
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  {[vehicle.year, vehicle.color].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {perms.write && (
                <div className="flex items-center gap-2">
                  {conditional && (
                    <RecordServiceButton vehicleId={vehicle.id} label={label} labelled />
                  )}
                  <VehicleFormButton
                    customerId={customerId}
                    canDelete={perms.remove}
                    vehicle={{
                      id: vehicle.id,
                      customerId,
                      make: vehicle.make,
                      model: vehicle.model,
                      year: vehicle.year,
                      color: vehicle.color,
                      paintCode: vehicle.paintCode,
                      plateNo: vehicle.plateNo,
                      notes: vehicle.notes,
                    }}
                  />
                </div>
              )}
            </header>

            {rows.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">
                لا كفالة مسجّلة لهذه السيارة.
              </p>
            ) : (
              <div className={cn('grid', conditional && 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
                <div>
                  <p className="px-4 pt-3 text-[11px] font-semibold text-[var(--text-2)] sm:px-5">الكفالات</p>
                  <div className="divide-y divide-[var(--line)]">
                    {rows.map((row) => (
                      <Link
                        key={row.id}
                        href={withFrom(`/dashboard/warranties/${row.id}`, here)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--glass)] sm:px-5"
                      >
                        <ShieldCheck className="size-4 shrink-0 text-[var(--text-2)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[var(--text-0)]">{row.name}</p>
                          <p className="text-[11px] text-[var(--text-2)]">
                            <span className="tnum" dir="ltr">
                              {row.certificateNo}
                            </span>{' '}
                            · حتى {formatDate(row.endDate)}
                          </p>
                        </div>
                        <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                      </Link>
                    ))}
                  </div>
                </div>

                {conditional?.service && (
                  <div className="border-t border-[var(--line)] px-4 py-3 sm:px-5 md:border-s md:border-t-0">
                    <p className="text-[11px] font-semibold text-[var(--text-2)]">
                      السيرفس الدوري · كل {conditional.every} أشهر
                    </p>
                    <p
                      className={cn(
                        'mt-1.5 text-[13px] font-semibold',
                        TONE_TEXT[conditional.service.tone] ?? 'text-[var(--text-1)]'
                      )}
                    >
                      {conditional.service.label}
                    </p>
                    {conditional.service.dueAt && (
                      <p className="tnum mt-0.5 text-[12px] text-[var(--text-2)]">
                        الموعد {formatDate(conditional.service.dueAt)}
                      </p>
                    )}
                    {vehicle.services.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {vehicle.services.map((visit) => (
                          <li key={visit.id} className="tnum text-[12px] text-[var(--text-1)]">
                            زيارة {formatDate(visit.visitedAt)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[12px] text-[var(--text-2)]">لم تُسجَّل زيارة سيرفس بعد.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {vehicle.notes && (
              <p className="whitespace-pre-line border-t border-[var(--line)] px-4 py-2.5 text-[12px] text-[var(--text-2)] sm:px-5">
                {vehicle.notes}
              </p>
            )}
          </section>
        );
      })}

      {!showAll && cars.length > VISIBLE_CARS && (
        <Link
          href={customerHref(customerId, { tab: 'cars', cars: 'all', from })}
          scroll={false}
          className="block rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-4 py-3 text-center text-[13px] font-medium text-accent hover:bg-[var(--glass)]"
        >
          عرض {cars.length - VISIBLE_CARS} سيارات أخرى
        </Link>
      )}

      {previous.length > 0 && (
        <details className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[13px] font-semibold text-[var(--text-0)] marker:content-none sm:px-5">
            سيارات سابقة ({previous.length})
            <ChevronDown className="size-4 text-[var(--text-2)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {previous.map((ownership) => (
              <div key={ownership.id} className="px-4 py-3 sm:px-5">
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-1)]">
                  {ownership.vehicle.make} {ownership.vehicle.model}
                  <Plate value={ownership.vehicle.plateNo} />
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-2)]">
                  حتى {formatDate(ownership.to)} · لدى {ownership.vehicle.customer.name} الآن
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
