import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Car,
  CircleAlert,
  Droplets,
  IdCard,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Plus,
  Receipt,
  StickyNote,
  Wrench,
} from 'lucide-react';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { CUSTOMER_SOURCE } from '@/lib/labels';
import { backTo } from '@/lib/back-link';
import { cn, formatDate, formatKWD, formatPhone, toNumber } from '@/lib/utils';
import { CustomerFormButton } from '../customer-form';
import { loadAttention } from './attention';
import { customerHref, parseLimit, type ProfilePerms, type TabKey } from './profile-data';
import { OverviewTab } from './tab-overview';
import { CarsTab } from './tab-cars';
import { WorkTab } from './tab-work';
import { InvoicesTab } from './tab-invoices';
import { WashTab } from './tab-wash';
import { ContactTab } from './tab-contact';

/*
  ملف العميل: بطاقة ثابتة بمن هو وكيف يُتواصل معه وما عليه، وبجانبها
  أقسام لكل نوع من بياناته — فلا يزدحم قسمٌ مهما كثرت سجلات العميل،
  و«نظرة عامة» لا تحمل إلا ما يحتاج تصرّفاً الآن وأحدث ما جرى.
*/

/** روابط قديمة حُفظت أو شوركت بأسماء الأقسام السابقة */
const LEGACY_TABS: Record<string, TabKey> = { summary: 'overview', history: 'work' };

interface TabDef {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  count?: number;
  alert?: number;
}

const JOINED = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kuwait',
});

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: customer?.name ?? 'العميل' };
}

function single(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export default async function CustomerDetailPage({
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
    invoices: can(role, 'pos:read'),
    wash: can(role, 'wash:read'),
    washWrite: can(role, 'wash:write'),
  };
  const from = single(query.from);
  const now = new Date();

  /*
    المال والزيارات لا تُقرأ أصلاً لمن لا يملك قسمها: الفنّي يفتح ملف
    العميل ليعرف سيارته، لا ليرى كم عليه.
  */
  const [customer, money, visits, attention] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        altPhone: true,
        email: true,
        civilId: true,
        address: true,
        area: true,
        notes: true,
        source: true,
        isBlocked: true,
        createdAt: true,
        pastPhones: { orderBy: { replacedAt: 'desc' }, take: 3, select: { id: true, phone: true } },
        _count: {
          select: {
            vehicles: true,
            bookings: true,
            jobOrders: perms.workshop,
            orders: perms.invoices,
            washSubscriptions: perms.wash,
            interactions: true,
          },
        },
      },
    }),
    perms.invoices
      ? db.order.aggregate({
          where: { customerId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
          _sum: { total: true, paidAmount: true },
        })
      : null,
    perms.workshop
      ? db.jobOrder.aggregate({
          where: { customerId: id, status: { not: 'CANCELLED' } },
          _count: true,
          _max: { receivedAt: true },
        })
      : null,
    loadAttention(id, perms, now),
  ]);

  if (!customer) notFound();

  const tabs: TabDef[] = [
    { key: 'overview', label: 'نظرة عامة', icon: LayoutGrid, alert: attention.length },
    { key: 'cars', label: 'السيارات', icon: Car, count: customer._count.vehicles },
    {
      key: 'work',
      label: perms.workshop ? 'الشغل والحجوزات' : 'الحجوزات',
      icon: Wrench,
      count: (perms.workshop ? customer._count.jobOrders : 0) + customer._count.bookings,
    },
    ...(perms.invoices
      ? [{ key: 'invoices' as const, label: 'الفواتير', icon: Receipt, count: customer._count.orders }]
      : []),
    ...(perms.wash
      ? [{ key: 'wash' as const, label: 'الغسيل', icon: Droplets, count: customer._count.washSubscriptions }]
      : []),
    { key: 'contact', label: 'التواصل', icon: MessagesSquare, count: customer._count.interactions },
  ];

  // المَعلمة من شريط العنوان: تُحصر في أقسام يراها صاحب الجلسة، وما عداها نظرة عامة
  const requested = single(query.tab);
  const wanted = requested ? (LEGACY_TABS[requested] ?? requested) : 'overview';
  const tab = tabs.find((item) => item.key === wanted)?.key ?? 'overview';
  // `from` يبقى في «هنا» كي يعود الرجوع من فاتورةٍ إلى الملف ومنه إلى القائمة بمرشّحها
  const here = customerHref(customer.id, { tab: tab === 'overview' ? undefined : tab, from });
  const limit = parseLimit(query.limit);

  const back = backTo(from, { href: '/dashboard/customers', label: 'العودة إلى العملاء' });

  let content: React.ReactNode;
  switch (tab) {
    case 'cars':
      content = (
        <CarsTab
          customerId={customer.id}
          here={here}
          from={from}
          perms={perms}
          showAll={single(query.cars) === 'all'}
          now={now}
        />
      );
      break;
    case 'work':
      content = (
        <WorkTab
          customerId={customer.id}
          here={here}
          from={from}
          perms={perms}
          blocked={customer.isBlocked}
          type={single(query.type)}
          limit={limit}
          now={now}
        />
      );
      break;
    case 'invoices':
      content = <InvoicesTab customerId={customer.id} here={here} from={from} limit={limit} />;
      break;
    case 'wash':
      content = <WashTab customerId={customer.id} here={here} perms={perms} />;
      break;
    case 'contact':
      content = <ContactTab customerId={customer.id} canWrite={perms.write} now={now} />;
      break;
    default:
      content = (
        <OverviewTab
          customerId={customer.id}
          here={here}
          from={from}
          attention={attention}
          perms={perms}
          now={now}
        />
      );
  }

  const invoiced = money ? toNumber(money._sum.total ?? 0) : 0;
  const outstanding = money
    ? Math.max(0, Math.round((invoiced - toNumber(money._sum.paidAmount ?? 0)) * 1000) / 1000)
    : 0;

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
                className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/15 text-[16px] font-bold text-accent"
              >
                {customer.name.trim().charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[17px] font-bold leading-snug text-[var(--text-0)]">{customer.name}</h1>
                  {customer.isBlocked && <Badge tone="danger">محظور</Badge>}
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-2)]">
                  <span className="tnum" dir="ltr">
                    {customer.code}
                  </span>{' '}
                  · عميل منذ {JOINED.format(customer.createdAt)}
                </p>
              </div>
            </div>

            {customer.isBlocked ? (
              <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                عميل محظور — لا يُنشأ له بيان تشغيل جديد.
              </p>
            ) : (
              perms.write && (
                /* العميل يصل مع الرابط فيُعلَّم في البيان — لا يُعاد اختياره */
                <Link
                  href={`/dashboard/job-orders/new?customer=${customer.id}`}
                  className={cn(buttonVariants({ size: 'md' }), 'mt-4 w-full')}
                >
                  <Plus />
                  بيان تشغيل جديد
                </Link>
              )
            )}

            <div className={cn('mt-2 grid gap-2', perms.write ? 'grid-cols-3' : 'grid-cols-2')}>
              <a
                href={`tel:${customer.phone}`}
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full px-2')}
              >
                <Phone />
                اتصال
              </a>
              <a
                href={`https://wa.me/${customer.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-ok/15 px-2 text-[13px] font-semibold text-ok hover:bg-ok/25"
              >
                <MessageCircle className="size-4" />
                واتساب
              </a>
              {perms.write && (
                <div className="[&>button]:w-full [&>button]:px-2">
                  <CustomerFormButton
                    variant="secondary"
                    customer={{
                      id: customer.id,
                      name: customer.name,
                      phone: customer.phone,
                      altPhone: customer.altPhone,
                      email: customer.email,
                      civilId: customer.civilId,
                      address: customer.address,
                      area: customer.area,
                      notes: customer.notes,
                      source: customer.source,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {(money || visits) && (
            <div className="grid grid-cols-2 border-t border-[var(--line)]">
              {money && (
                <>
                  <Link
                    href={customerHref(customer.id, { tab: 'invoices', from })}
                    className={cn(
                      'border-e border-[var(--line)] p-4 transition-colors',
                      visits && 'border-b',
                      outstanding > 0 ? 'bg-danger/8 hover:bg-danger/12' : 'hover:bg-[var(--glass)]'
                    )}
                  >
                    <p className={cn('text-[11px]', outstanding > 0 ? 'text-danger' : 'text-[var(--text-2)]')}>
                      المستحق
                    </p>
                    <p
                      className={cn(
                        'tnum mt-1 text-[15px] font-bold',
                        outstanding > 0 ? 'text-danger' : 'text-[var(--text-0)]'
                      )}
                    >
                      {formatKWD(outstanding)}
                    </p>
                  </Link>
                  <Stat label="إجمالي الفواتير" value={formatKWD(invoiced)} className={cn(visits && 'border-b')} />
                </>
              )}
              {visits && (
                <>
                  <Stat label="الزيارات" value={String(visits._count)} className="border-e" />
                  <Stat label="آخر زيارة" value={formatDate(visits._max.receivedAt)} />
                </>
              )}
            </div>
          )}

          <dl className="space-y-3.5 border-t border-[var(--line)] p-5">
            <Info icon={Phone} label="الهاتف">
              <a href={`tel:${customer.phone}`} className="tnum hover:text-accent" dir="ltr">
                {formatPhone(customer.phone)}
              </a>
            </Info>
            {(customer.altPhone || customer.pastPhones.length > 0) && (
              <Info icon={Phone} label={customer.altPhone ? 'رقم بديل' : 'أرقام سابقة'}>
                {customer.altPhone && (
                  <span className="tnum block" dir="ltr">
                    {formatPhone(customer.altPhone)}
                  </span>
                )}
                {customer.pastPhones.map((past) => (
                  <span key={past.id} className="block text-[11px] text-[var(--text-2)]">
                    {customer.altPhone && 'سابق: '}
                    <span className="tnum" dir="ltr">
                      {formatPhone(past.phone)}
                    </span>
                  </span>
                ))}
              </Info>
            )}
            {customer.email && (
              <Info icon={Mail} label="البريد">
                <a href={`mailto:${customer.email}`} className="break-all hover:text-accent" dir="ltr">
                  {customer.email}
                </a>
              </Info>
            )}
            {(customer.area || customer.address) && (
              <Info icon={MapPin} label="العنوان">
                {[customer.area, customer.address].filter(Boolean).join(' — ')}
              </Info>
            )}
            {customer.civilId && (
              <Info icon={IdCard} label="الرقم المدني">
                <span className="tnum" dir="ltr">
                  {customer.civilId}
                </span>
              </Info>
            )}
            {customer.notes && (
              <Info icon={StickyNote} label="ملاحظات">
                {customer.notes}
              </Info>
            )}
            <p className="border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-2)]">
              المصدر: {CUSTOMER_SOURCE[customer.source].label}
            </p>
          </dl>
        </aside>

        <div className="min-w-0">
          <nav aria-label="أقسام ملف العميل" className="mb-4 overflow-x-auto border-b border-[var(--line)]">
            <div className="flex min-w-max gap-1">
              {tabs.map((item) => {
                const active = item.key === tab;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={customerHref(customer.id, {
                      tab: item.key === 'overview' ? undefined : item.key,
                      from,
                    })}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      /* الإطار العام حول الروابط يلتفّ على اللسان مربّعاً — الخطّ السفلي والخلفية يكفيان للوحة المفاتيح */
                      '-mb-px inline-flex items-center gap-2 rounded-t-[var(--radius-sm)] border-b-2 px-3.5 py-3 text-[13px] transition-colors focus-visible:bg-[var(--glass-strong)] focus-visible:outline-none',
                      active
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

          {content}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('border-[var(--line)] p-4', className)}>
      <p className="text-[11px] text-[var(--text-2)]">{label}</p>
      <p className="tnum mt-1 text-[15px] font-bold text-[var(--text-0)]">{value}</p>
    </div>
  );
}

function Info({
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
      <div className="min-w-0">
        <dt className="text-[11px] text-[var(--text-2)]">{label}</dt>
        <dd className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-1)]">{children}</dd>
      </div>
    </div>
  );
}
