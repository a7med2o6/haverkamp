import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, CalendarDays, Receipt, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, formatDateTime, formatKWD } from '@/lib/utils';
import type { ProfileEvent, Tone } from './profile-data';

const KIND_META: Record<ProfileEvent['kind'], { label: string; icon: LucideIcon }> = {
  job: { label: 'أمر شغل', icon: Wrench },
  booking: { label: 'حجز', icon: CalendarDays },
  invoice: { label: 'فاتورة', icon: Receipt },
};

export const TONE_TEXT: Partial<Record<Tone, string>> = {
  danger: 'text-danger',
  warn: 'text-warn',
  ok: 'text-ok',
};

const MONTH = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kuwait',
});

export function Panel({
  title,
  icon: Icon,
  iconClassName,
  count,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]',
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-[var(--text-0)]">
          {Icon && <Icon className={cn('size-4', iconClassName ?? 'text-accent')} />}
          {title}
          {count != null && (
            <span className="tnum text-[12px] font-medium text-[var(--text-2)]">({count})</span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
    >
      {children}
      <ArrowLeft className="size-3.5" />
    </Link>
  );
}

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)]',
        className ?? 'bg-[var(--glass-strong)] text-[var(--text-1)]'
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function Plate({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span
      className="tnum inline-block rounded-[6px] border border-[var(--line-strong)] px-1.5 py-px text-[11px] font-semibold text-[var(--text-1)]"
      dir="ltr"
    >
      {value}
    </span>
  );
}

export function EmptyPanel({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-5 sm:px-5">
      <p className="text-[13px] text-[var(--text-2)]">{text}</p>
      {action}
    </div>
  );
}

export function EventRow({ event }: { event: ProfileEvent }) {
  const meta = KIND_META[event.kind];
  return (
    <Link
      href={event.href}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 transition-colors hover:bg-[var(--glass)] sm:px-5"
    >
      <IconTile icon={meta.icon} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] text-[var(--text-2)]">{meta.label}</span>
          <span className="tnum text-[13px] font-semibold text-accent" dir="ltr">
            {event.number}
          </span>
          <Badge tone={event.status.tone}>{event.status.label}</Badge>
        </div>
        <p className="mt-1 truncate text-[12px] text-[var(--text-1)]">{event.detail}</p>
        {event.payments && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-2)]">{event.payments}</p>
        )}
      </div>
      <div className="text-end">
        {event.amount != null && (
          <p className="tnum whitespace-nowrap text-[13px] font-bold text-[var(--text-0)]">
            {formatKWD(event.amount)}
          </p>
        )}
        {event.remaining != null && (
          <p className="tnum whitespace-nowrap text-[11px] font-semibold text-danger">
            متبقي {formatKWD(event.remaining)}
          </p>
        )}
        <p className="tnum mt-0.5 whitespace-nowrap text-[11px] text-[var(--text-2)]">
          {event.withTime ? formatDateTime(event.date) : formatDate(event.date)}
        </p>
      </div>
    </Link>
  );
}

export function EventList({ events }: { events: ProfileEvent[] }) {
  return (
    <div className="divide-y divide-[var(--line)]">
      {events.map((event) => (
        <EventRow key={`${event.kind}-${event.id}`} event={event} />
      ))}
    </div>
  );
}

/** الصفوف تصل مرتّبة من الأحدث؛ الشهر يُفتح عنواناً كلما تغيّر */
export function MonthGroups({
  events,
  footer,
}: {
  events: ProfileEvent[];
  footer?: React.ReactNode;
}) {
  const groups: { label: string; items: ProfileEvent[] }[] = [];
  for (const event of events) {
    const label = MONTH.format(event.date);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(event);
    else groups.push({ label, items: [event] });
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
      {groups.map((group, index) => (
        <div key={`${group.label}-${index}`}>
          <p
            className={cn(
              'bg-[var(--surface-2)] px-4 py-2 text-[12px] font-semibold text-[var(--text-2)] sm:px-5',
              index > 0 && 'border-t border-[var(--line)]'
            )}
          >
            {group.label}
          </p>
          <div className="border-t border-[var(--line)]">
            <EventList events={group.items} />
          </div>
        </div>
      ))}
      {footer && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[var(--line)] px-4 py-3 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}
