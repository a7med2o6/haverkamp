import type { Metadata } from 'next';
import Image from 'next/image';
import { AlertCircle, Car, CalendarDays, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { formatReminderWhen } from '@/lib/reminders';
import { availableSlots } from '@/lib/slots';
import { bookingServiceLabel } from '@/lib/intake';
import { ConfirmForm } from './confirm-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'تأكيد الموعد',
  // صفحة خاصة بصاحب الرابط — لا مكان لها في نتائج البحث
  robots: { index: false, follow: false },
};

/**
 * صفحة تأكيد الموعد العامة.
 * يفتحها العميل من رابط تذكير الواتساب بلا تسجيل دخول، فالتوكن وحده
 * مفتاحها. لا تعرض إلا ما يخصّ حجزه: لا كود ولا هاتف ولا بيانات غيره،
 * حتى لا يتحوّل الرابط المُعاد توجيهه إلى تسريب.
 */
export default async function ConfirmBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const booking = await db.booking.findUnique({
    where: { confirmToken: token },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      confirmedAt: true,
      rescheduledAt: true,
      guestName: true,
      guestCar: true,
      serviceKey: true,
      serviceSpec: true,
      jobOrder: { select: { id: true } },
      customer: { select: { name: true } },
      vehicle: { select: { make: true, model: true } },
      service: {
        include: { translations: { where: { locale: 'ar' }, select: { name: true } } },
      },
    },
  });

  const name = booking?.customer?.name ?? booking?.guestName ?? null;
  const car = booking?.vehicle
    ? `${booking.vehicle.make} ${booking.vehicle.model}`
    : booking?.guestCar;
  const service = booking ? bookingServiceLabel(booking) : null;

  const now = new Date();
  const past = booking ? booking.scheduledAt < now : false;
  const blocked = !booking
    ? 'هذا الرابط غير صالح أو انتهت صلاحيته.'
    : booking.status === 'CANCELLED'
      ? 'هذا الحجز ملغي. تواصل معنا لحجز موعد جديد.'
      : booking.jobOrder
        ? 'العمل على سيارتك بدأ بالفعل. تواصل معنا لأي تعديل.'
        : past
          ? 'انقضى موعد هذا الحجز. تواصل معنا لحجز موعد جديد.'
          : null;

  // لا نبني المواعيد للحجز المغلق — استعلام بلا فائدة على صفحة عامة
  const { days } = blocked
    ? { days: [] }
    : await availableSlots({ now, exceptId: booking!.id });

  return (
    <main className="login-page relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="login-glow pointer-events-none absolute inset-0 -z-10" />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/assets/logo.png"
            alt="هافركامب"
            width={140}
            height={48}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="login-card rounded-[var(--radius-lg)] p-6">
          {blocked ? (
            <div className="text-center">
              <AlertCircle className="mx-auto size-9 text-[var(--text-2)]" />
              <p className="mt-4 text-[14px] text-[var(--text-1)]">{blocked}</p>
            </div>
          ) : (
            <>
              <h1 className="text-center text-lg font-bold text-[var(--text-0)]">
                {name ? `مرحباً ${name}` : 'تأكيد الموعد'}
              </h1>
              <p className="mt-1.5 text-center text-[13px] text-[var(--text-1)]">
                هذا موعدك القادم في هافركامب — أكّده لنجهّز لك كل شيء، أو
                غيّره لما يناسبك.
              </p>

              <dl className="my-6 space-y-3 border-y border-[var(--line)] py-5">
                <Row icon={<CalendarDays className="size-4" />} label="الموعد">
                  {formatReminderWhen(booking!.scheduledAt)}
                </Row>
                {service && (
                  <Row icon={<Wrench className="size-4" />} label="الخدمة">
                    {service}
                  </Row>
                )}
                {car && (
                  <Row icon={<Car className="size-4" />} label="السيارة">
                    {car}
                  </Row>
                )}
              </dl>

              <ConfirmForm
                token={token}
                confirmed={!!booking!.confirmedAt}
                days={days}
              />

              <p className="mt-4 text-center text-[12px] text-[var(--text-2)]">
                للاعتذار عن الموعد، ردّ على رسالة الواتساب.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-2)]">
          © {new Date().getFullYear()} هافركامب الكويت
        </p>
      </div>
    </main>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-accent">{icon}</span>
      <div>
        <dt className="text-[11px] text-[var(--text-2)]">{label}</dt>
        <dd className="text-[14px] font-semibold text-[var(--text-0)]">{children}</dd>
      </div>
    </div>
  );
}
