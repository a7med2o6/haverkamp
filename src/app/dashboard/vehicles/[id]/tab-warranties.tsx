import Link from 'next/link';
import { CalendarCheck, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { withFrom } from '@/lib/back-link';
import { SERVICE_GRACE_DAYS } from '@/lib/intake';
import { cn, formatDate } from '@/lib/utils';
import {
  VEHICLE_WARRANTY_SELECT,
  mostUrgentService,
  warrantyRows,
  type ProfilePerms,
} from '@/app/dashboard/_profile/data';
import { EmptyPanel, Panel, TONE_TEXT } from '@/app/dashboard/_profile/parts';
import { DeleteServiceButton, RecordServiceButton } from '@/app/dashboard/customers/[id]/service-form';

/** خمسون زيارة سيرفس تغطّي أكثر من عشر سنوات بشرط كل ثلاثة أشهر */
const VISITS_SHOWN = 50;

export async function VehicleWarrantiesTab({
  vehicleId,
  ownerId,
  carLabel,
  here,
  perms,
  now,
}: {
  vehicleId: string;
  ownerId: string;
  carLabel: string;
  here: string;
  perms: ProfilePerms;
  now: Date;
}) {
  const [warranties, visits] = await Promise.all([
    db.warranty.findMany({
      where: { vehicleId },
      orderBy: [{ isVoid: 'asc' }, { endDate: 'desc' }],
      select: {
        ...VEHICLE_WARRANTY_SELECT,
        customer: { select: { id: true, name: true } },
      },
    }),
    db.vehicleService.findMany({
      where: { vehicleId },
      orderBy: { visitedAt: 'desc' },
      take: VISITS_SHOWN,
      select: { id: true, visitedAt: true, notes: true, user: { select: { name: true } } },
    }),
  ]);

  if (warranties.length === 0 && visits.length === 0) {
    return <EmptyPanel text="لا كفالات ولا زيارات سيرفس على هذه السيارة." />;
  }

  const live = warranties.filter((warranty) => !warranty.isVoid);
  const rows = warrantyRows(live, visits[0]?.visitedAt ?? null, now);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const payerById = new Map(warranties.map((warranty) => [warranty.id, warranty.customer]));
  // الساريةُ بترتيب إلحاحها أولاً، ثم الملغاة شاهدةً على ما كان
  const ordered = [
    ...rows.map((row) => ({ id: row.id, row, isVoid: false, name: row.name, certificateNo: row.certificateNo, endDate: row.endDate })),
    ...warranties
      .filter((warranty) => warranty.isVoid)
      .map((warranty) => ({
        id: warranty.id,
        row: undefined,
        isVoid: true,
        name: rowById.get(warranty.id)?.name ?? warranty.subject ?? warranty.service?.translations[0]?.name ?? 'كفالة عامة',
        certificateNo: warranty.certificateNo,
        endDate: warranty.endDate,
      })),
  ];
  const urgent = mostUrgentService(rows);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title="الكفالات" icon={ShieldCheck} count={warranties.length}>
        {ordered.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لا كفالة على هذه السيارة.</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {ordered.map((item) => {
              const payer = payerById.get(item.id);
              return (
                <Link
                  key={item.id}
                  href={withFrom(`/dashboard/warranties/${item.id}`, here)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--glass)] sm:px-5',
                    item.isVoid && 'opacity-70'
                  )}
                >
                  <ShieldCheck className="size-4 shrink-0 text-[var(--text-2)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--text-0)]">{item.name}</p>
                    <p className="text-[11px] text-[var(--text-2)]">
                      <span className="tnum" dir="ltr">
                        {item.certificateNo}
                      </span>{' '}
                      · حتى {formatDate(item.endDate)}
                    </p>
                    {/*
                      الكفالة باسم من دفعها ولا تنتقل مع البيع — تُذكر باسمه، ويُنبَّه
                      حين لا يكون مالك السيارة اليوم كي لا يُظنّ أنها له.
                    */}
                    <p className="mt-0.5 text-[11px] text-[var(--text-2)]">
                      {payer ? `باسم ${payer.name}` : 'صاحبها غير مسجّل'}
                      {payer && payer.id !== ownerId && (
                        <span className="font-semibold text-warn"> · ليست باسم المالك الحالي</span>
                      )}
                    </p>
                  </div>
                  {item.row ? (
                    <Badge tone={item.row.badge.tone}>{item.row.badge.label}</Badge>
                  ) : (
                    <Badge tone="muted">ملغاة</Badge>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title={urgent ? `السيرفس الدوري · كل ${urgent.row.every} أشهر` : 'زيارات السيرفس'}
        icon={CalendarCheck}
        action={
          perms.write && urgent ? <RecordServiceButton vehicleId={vehicleId} label={carLabel} labelled /> : null
        }
      >
        {urgent && (
          <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5">
            <p className={cn('text-[14px] font-bold', TONE_TEXT[urgent.service.tone] ?? 'text-[var(--text-0)]')}>
              {urgent.service.label}
            </p>
            {urgent.service.dueAt && (
              <p className="tnum mt-1 text-[12px] text-[var(--text-2)]">
                الموعد {formatDate(urgent.service.dueAt)}
                {urgent.service.deadline && ` · بمهلة ${SERVICE_GRACE_DAYS} يوماً حتى ${formatDate(urgent.service.deadline)}`}
              </p>
            )}
            <p className="mt-1 text-[11px] text-[var(--text-2)]">بحسب «{urgent.row.name}»</p>
          </div>
        )}
        {visits.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--text-2)] sm:px-5">لم تُسجَّل زيارة سيرفس بعد.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {visits.map((visit) => (
              <li key={visit.id} className="flex items-start justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-1)]">
                    <span className="tnum">{formatDate(visit.visitedAt)}</span>
                    {visit.user?.name && <span className="text-[var(--text-2)]"> · {visit.user.name}</span>}
                  </p>
                  {visit.notes && (
                    <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-[var(--text-2)]">
                      {visit.notes}
                    </p>
                  )}
                </div>
                {perms.write && <DeleteServiceButton id={visit.id} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
