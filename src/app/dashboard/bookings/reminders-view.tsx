import Link from 'next/link';
import { BellRing, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { cn, formatBookingTime, formatDayLabel, formatPhone, formatWeekday } from '@/lib/utils';
import {
  buildReminderMessage,
  confirmUrl,
  formatReminderWhen,
  reminderPhone,
  type ReminderBooking,
} from '@/lib/reminders';
import { isCloudApiReady, waMeLink } from '@/lib/whatsapp';
import { bookingServiceLabel } from '@/lib/intake';
import { ReminderButton } from './reminder-button';

/**
 * طابور تذكيرات اليوم التالي.
 *
 * يظهر الطابور سواء كان الإرسال التلقائي مفعّلاً أم لا: القالب قد يُرفض،
 * والرصيد قد ينفد، ورقم قد يكون خاطئاً — وحينها يبقى الحجز هنا ليُرسل
 * بيد الموظف بدل أن يمرّ الموعد بلا تذكير.
 */
export function RemindersView({
  day,
  dayDate,
  bookings,
  canWrite,
}: {
  /** اليوم المعروض: YYYY-MM-DD */
  day: string;
  dayDate: Date;
  bookings: ReminderBooking[];
  canWrite: boolean;
}) {
  const shift = (days: number) => {
    const d = new Date(`${day}T12:00:00+03:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const pendingCount = bookings.filter((b) => !b.reminderSentAt).length;
  const auto = isCloudApiReady();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[var(--text-0)]">
          تذكيرات {formatWeekday(dayDate)} {formatDayLabel(dayDate)}
          <span className="tnum ms-2 text-[13px] font-medium text-[var(--text-2)]">
            {pendingCount} بانتظار الإرسال من {bookings.length}
          </span>
        </h2>

        <div className="flex items-center gap-1.5">
          <NavLink href={`?view=reminders&day=${shift(-1)}`} label="اليوم السابق">
            <ChevronRight className="size-4" />
          </NavLink>
          <Link
            href="?view=reminders"
            className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-1)] transition-colors hover:border-accent hover:text-accent"
          >
            الغد
          </Link>
          <NavLink href={`?view=reminders&day=${shift(1)}`} label="اليوم التالي">
            <ChevronLeft className="size-4" />
          </NavLink>
        </div>
      </div>

      {/* حالة قناة الإرسال — الموظف يحتاج معرفة إن كان عليه الضغط بنفسه */}
      <div
        className={cn(
          'mb-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-[12px]',
          auto
            ? 'border-ok/40 bg-ok/10 text-[var(--text-1)]'
            : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-1)]'
        )}
      >
        {auto ? (
          <Zap className="mt-0.5 size-4 shrink-0 text-ok" />
        ) : (
          <BellRing className="mt-0.5 size-4 shrink-0 text-[var(--text-2)]" />
        )}
        <p>
          {auto ? (
            <>
              <strong className="font-semibold text-[var(--text-0)]">
                الإرسال التلقائي مفعّل
              </strong>{' '}
              — المهمة المجدولة ترسل تذكيرات الغد يومياً. ما يبقى هنا لم يُرسل
              تلقائياً (رقم غير صالح أو فشل الإرسال) فأرسله بنفسك.
            </>
          ) : (
            <>
              <strong className="font-semibold text-[var(--text-0)]">
                الإرسال يدوي
              </strong>{' '}
              — اضغط «إرسال» ليفتح الواتساب برسالة جاهزة. لتفعيل الإرسال
              التلقائي اضبط <code className="tnum">WHATSAPP_TOKEN</code> و
              <code className="tnum">WHATSAPP_PHONE_ID</code> و
              <code className="tnum">CRON_SECRET</code>.
            </>
          )}
        </p>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>الوقت</Th>
              <Th>العميل</Th>
              <Th>الهاتف</Th>
              <Th>الخدمة</Th>
              <Th>الحالة</Th>
              <Th>التذكير</Th>
              {canWrite && <Th />}
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <EmptyState
                title="لا تذكيرات لهذا اليوم"
                description="تظهر هنا حجوزات اليوم التالي التي لم تتحوّل بعد إلى أوامر شغل"
                colSpan={7}
              />
            ) : (
              bookings.map((b) => {
                const phone = reminderPhone(b);
                const name = b.customer?.name ?? b.guestName ?? 'زائر';
                const message = buildReminderMessage(b, confirmUrl(b.confirmToken));

                return (
                  <Tr key={b.id}>
                    <Td className="tnum text-[12px]">
                      {formatBookingTime(b.scheduledAt) ?? 'بدون وقت'}
                    </Td>
                    <Td className="font-medium text-[var(--text-0)]">{name}</Td>
                    <Td className="tnum text-[12px]" dir="ltr">
                      {formatPhone(b.customer?.phone ?? b.guestPhone)}
                    </Td>
                    <Td className="text-[12px]">
                      {bookingServiceLabel(b) ?? '—'}
                    </Td>
                    <Td>
                      {b.rescheduledAt ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-info">
                          <CalendarClock className="size-3.5" />
                          غيّره العميل
                        </span>
                      ) : b.confirmedAt ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok">
                          <CheckCircle2 className="size-3.5" />
                          أكّده العميل
                        </span>
                      ) : b.status === 'CONFIRMED' ? (
                        <Badge tone="accent">مؤكد</Badge>
                      ) : (
                        <Badge tone="warn">بانتظار التأكيد</Badge>
                      )}
                    </Td>
                    <Td className="tnum text-[12px] text-[var(--text-2)]">
                      {b.reminderSentAt
                        ? formatReminderWhen(b.reminderSentAt)
                        : '— لم يُرسل'}
                    </Td>
                    {canWrite && (
                      <Td>
                        <div title={message}>
                          <ReminderButton
                            id={b.id}
                            href={phone ? waMeLink(phone, message) : null}
                            sent={!!b.reminderSentAt}
                          />
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[var(--line)] text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </Link>
  );
}
