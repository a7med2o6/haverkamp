'use client';

import Link from 'next/link';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, MessageSquare, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { BOOKING_STATUS, CUSTOMER_SOURCE } from '@/lib/labels';
import { buildReminderMessage, confirmUrl } from '@/lib/reminders';
import { cn, formatBookingTime, formatDayLabel, formatPhone, formatWeekday } from '@/lib/utils';
import { waMeLink } from '@/lib/whatsapp';
import type { CalendarBooking } from './calendar';
import {
  BookingFormButton,
  BookingStatusSelect,
  ConvertToJobButton,
} from './bookings-client';
import { ReminderButton } from './reminder-button';

/**
 * لوحة اليوم الجانبية الثابتة على شاشات سطح المكتب.
 * يعتمد عليها موظف الاستقبال لمعاينة حجوزات اليوم المختار وتعديلها وإدارتها دون التنقل بعيداً عن التقويم.
 */
export function DayPanel({
  variant = 'aside',
  selectedDay,
  selectedDate,
  bookings,
  expandedBookingId,
  onToggleExpand,
  canWrite,
  canWorkshop,
  customers,
}: {
  variant?: 'aside' | 'inline';
  /** مفتاح اليوم المختار صيغة YYYY-MM-DD */
  selectedDay: string;
  selectedDate: Date;
  bookings: CalendarBooking[];
  expandedBookingId: string | null;
  onToggleExpand: (id: string) => void;
  canWrite: boolean;
  canWorkshop: boolean;
  customers: Array<{ id: string; name: string; phone: string }>;
}) {
  const sortedBookings = [...bookings].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  );

  const defaultScheduledAt = `${selectedDay}T10:00`;

  return (
    <aside
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-sm',
        variant === 'aside'
          ? 'hidden lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto'
          : 'block lg:hidden mt-4'
      )}
    >
      {/* ترويسة اللوحة: اليوم والعدد وزر الإضافة ورابط الأسبوع */}
      <div className="mb-4 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-[var(--text-0)]">
              يوم {formatWeekday(selectedDate)} {formatDayLabel(selectedDate)}
            </h3>
            <Badge tone="muted" className="tnum">
              {sortedBookings.length > 0 ? `${sortedBookings.length} حجز` : 'لا حجوزات'}
            </Badge>
          </div>
          <Link
            href={`?view=week&week=${selectedDay}`}
            className="text-[12px] font-semibold text-accent hover:underline shrink-0"
          >
            الأسبوع
          </Link>
        </div>

        {canWrite && (
          <div className="mt-3">
            <BookingFormButton
              customers={customers}
              defaultScheduledAt={defaultScheduledAt}
            />
          </div>
        )}
      </div>

      {/* قائمة الحجوزات */}
      {sortedBookings.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-[var(--text-2)] space-y-3">
          {/* زرّ الإضافة في رأس اللوحة فوقه مباشرة؛ نسخةٌ ثانية هنا تكرار */}
          <p>{canWrite ? 'فاضي — أضف حجزاً من الزرّ أعلاه' : 'فاضي'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedBookings.map((b) => {
            const isExpanded = expandedBookingId === b.id;
            const time = formatBookingTime(b.scheduledAt);

            // تجهيز كائن تذكير وهمي لاستخراج رسالة الواتساب
            const reminderBooking = {
              scheduledAt: b.scheduledAt,
              customer: b.customerId ? { name: b.name, phone: b.phone ?? '' } : null,
              guestName: b.guestName,
              guestCar: b.guestCar,
              vehicle: b.car && !b.guestCar ? { make: b.car, model: '' } : null,
              service: b.service ? { translations: [{ name: b.service }] } : null,
              serviceKey: b.serviceKey,
              serviceSpec: b.serviceSpec,
            } as Parameters<typeof buildReminderMessage>[0];

            const reminderMsg = buildReminderMessage(
              reminderBooking,
              b.confirmToken ? confirmUrl(b.confirmToken) : ''
            );
            const waLink = b.phone ? waMeLink(b.phone, reminderMsg) : null;

            return (
              <div
                key={b.id}
                className={cn(
                  'rounded-[var(--radius-md)] border bg-[var(--surface-2)] transition-all',
                  isExpanded ? 'border-accent ring-1 ring-accent' : 'border-[var(--line)] hover:border-[var(--line-strong)]'
                )}
              >
                {/* رأس الصف المتوسع */}
                <button
                  type="button"
                  onClick={() => onToggleExpand(b.id)}
                  className="w-full p-3 text-start transition-colors hover:bg-[var(--glass-light)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="tnum text-[12px] font-bold text-accent" dir="ltr">
                          {time ?? 'بدون وقت'}
                        </span>
                        <Badge tone={BOOKING_STATUS[b.status].tone}>
                          {BOOKING_STATUS[b.status].label}
                        </Badge>
                      </div>
                      <p className="truncate text-[13px] font-bold text-[var(--text-0)]">
                        {b.name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--text-2)]">
                        {b.service || '—'}
                      </p>
                      {b.car && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-1)]">
                          <span>{b.car}</span>
                          {b.plateNo && (
                            <span className="tnum rounded bg-[var(--surface-1)] border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-mono" dir="ltr">
                              {b.plateNo}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[var(--text-2)] mt-1">
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </span>
                  </div>

                  {/* أوسمة تنبيه صغيرة */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {b.reminderSentAt && (
                      <span className="inline-flex items-center gap-1 text-ok font-medium">
                        <CheckCircle2 className="size-3" />
                        أُرسل التذكير
                      </span>
                    )}
                    {b.confirmedAt && (
                      <span className="inline-flex items-center gap-1 text-ok font-medium">
                        <CheckCircle2 className="size-3" />
                        أكّده العميل
                      </span>
                    )}
                    {b.rescheduledAt && (
                      <span className="inline-flex items-center gap-1 text-info font-medium">
                        <CalendarClock className="size-3" />
                        غيّره العميل
                      </span>
                    )}
                  </div>
                </button>

                {/* التفاصيل المعروضة عند النقر */}
                {isExpanded && (
                  <div className="border-t border-[var(--line)] p-3 space-y-3 bg-[var(--surface-1)] rounded-b-[var(--radius-md)]">
                    {/* معلومات التواصل */}
                    {b.phone ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="tnum text-[12px] font-semibold text-[var(--text-0)]" dir="ltr">
                          {formatPhone(b.phone)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${b.phone}`}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 px-2 text-[11px] gap-1')}
                          >
                            <Phone className="size-3" />
                            اتصال
                          </a>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 px-2 text-[11px] gap-1 text-ok hover:text-ok')}
                            >
                              <MessageSquare className="size-3" />
                              واتساب
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--text-2)]">لا يوجد رقم هاتف</p>
                    )}

                    {/* الملاحظات والمصدر */}
                    {b.notes && (
                      <div className="text-[12px] text-[var(--text-1)] bg-[var(--surface-2)] p-2 rounded border border-[var(--line)]">
                        <span className="font-semibold block text-[11px] text-[var(--text-2)] mb-0.5">ملاحظات:</span>
                        {b.notes}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-2)]">المصدر:</span>
                      <Badge tone={CUSTOMER_SOURCE[b.source].tone}>
                        {CUSTOMER_SOURCE[b.source].label}
                      </Badge>
                    </div>

                    {/* أدوات التحكم والإجراءات حسب الصلاحيات */}
                    <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center gap-2">
                      {canWrite && (
                        <BookingStatusSelect id={b.id} status={b.status} />
                      )}

                      {canWrite && (
                        <BookingFormButton
                          customers={customers}
                          booking={{
                            id: b.id,
                            customerId: b.customerId,
                            vehicleId: b.vehicleId,
                            serviceKey: b.serviceKey,
                            serviceSpec: b.serviceSpec,
                            guestName: b.guestName,
                            guestPhone: b.guestPhone,
                            guestCar: b.guestCar,
                            scheduledAt: b.scheduledAtLocal,
                            notes: b.notes,
                            status: b.status,
                          }}
                        />
                      )}

                      {canWrite && !b.reminderSentAt && (b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <ReminderButton
                          id={b.id}
                          href={waLink}
                          sent={!!b.reminderSentAt}
                        />
                      )}

                      {b.jobOrder ? (
                        <Link
                          href={`/dashboard/job-orders/${b.jobOrder.id}`}
                          className="tnum text-[12px] font-semibold text-accent hover:underline ms-auto"
                          dir="ltr"
                        >
                          {b.jobOrder.number}
                        </Link>
                      ) : (
                        canWorkshop &&
                        b.status !== 'CANCELLED' && (
                          <ConvertToJobButton id={b.id} />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
