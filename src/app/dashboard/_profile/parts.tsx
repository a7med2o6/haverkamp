import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, CalendarDays, CircleAlert, CircleCheck, Receipt, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, formatDateTime, formatKWD } from '@/lib/utils';
import type { ProfileEvent, Tone } from './data';

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

/** ما يُرى دون نقرة؛ الباقي تحت «عرض N أخرى» كي لا تغرق الصفحة في يوم مزدحم */
const VISIBLE_ATTENTION = 4;

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

/* ─────────────────────────── بطاقة الملف ─────────────────────────── */

export function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('border-[var(--line)] p-4', className)}>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p className="tnum mt-1 text-[15px] font-bold text-[var(--text-0)]">{value}</p>
    </div>
  );
}

export function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--text-2)]" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-[var(--text-2)]">{label}</dt>
        <dd className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">{children}</dd>
      </div>
    </div>
  );
}

export interface ProfileTabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  alert?: number;
}

export function ProfileTabs({
  label,
  tabs,
  active,
  hrefFor,
}: {
  label: string;
  tabs: ProfileTabItem[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    /*
      الخطّ الرمادي ظلٌّ داخل الصفّ لا حدٌّ للحاوية: الحدّ مع إنزال اللسان
      بكسلاً فوقه يفيض عن الحاوية عمودياً، والتمرير الأفقي يجرّ معه شريط
      تمريرٍ عمودياً يظهر في آخر الألسنة.
    */
    <nav aria-label={label} className="mb-4 overflow-x-auto">
      <div className="flex w-max min-w-full gap-1 shadow-[inset_0_-1px_0_var(--line)]">
        {tabs.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={hrefFor(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                /* الإطار العام حول الروابط يلتفّ على اللسان مربّعاً — الخطّ السفلي والخلفية يكفيان للوحة المفاتيح */
                'inline-flex items-center gap-2 rounded-t-[var(--radius-sm)] border-b-2 px-3.5 py-3 text-[13px] transition-colors focus-visible:bg-[var(--glass-strong)] focus-visible:outline-none',
                isActive
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent font-medium text-[var(--text-2)] hover:text-[var(--text-0)]'
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {item.alert ? (
                <span className="tnum rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-[var(--danger-ink)]">
                  {item.alert}
                </span>
              ) : item.count != null ? (
                <span className="tnum rounded-full bg-[var(--glass-strong)] px-1.5 text-[11px] leading-4 text-[var(--text-2)]">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ─────────────────────────── يحتاج انتباه ─────────────────────────── */

export interface AttentionRowView {
  id: string;
  icon: LucideIcon;
  tile: string;
  title: string;
  detail: string;
  action: React.ReactNode;
}

export function AttentionPanel({ rows, calmText }: { rows: AttentionRowView[]; calmText: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3.5 text-[13px] text-[var(--text-1)] sm:px-5">
        <CircleCheck className="size-4 shrink-0 text-ok" />
        {calmText}
      </div>
    );
  }

  const shown = rows.slice(0, VISIBLE_ATTENTION);
  const hidden = rows.slice(VISIBLE_ATTENTION);

  return (
    <Panel title="يحتاج انتباه" icon={CircleAlert} iconClassName="text-danger" count={rows.length}>
      <div className="divide-y divide-[var(--line)]">
        {shown.map((row) => (
          <AttentionLine key={row.id} {...row} />
        ))}
      </div>
      {hidden.length > 0 && (
        <details className="group border-t border-[var(--line)]">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-center text-[12px] font-medium text-accent marker:content-none sm:px-5">
            <span className="group-open:hidden">عرض {hidden.length} أخرى</span>
            <span className="hidden group-open:inline">إخفاء</span>
          </summary>
          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {hidden.map((row) => (
              <AttentionLine key={row.id} {...row} />
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}

function AttentionLine({ icon, tile, title, detail, action }: AttentionRowView) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <IconTile icon={icon} className={tile} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--text-0)]">{title}</p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/* ─────────────────────────── صفوف النشاط ─────────────────────────── */

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
