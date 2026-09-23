import type { Metadata } from 'next';
import Image from 'next/image';
import { AlertCircle, Calendar, Car, CalendarClock, MapPin, ShieldAlert, Sparkles } from 'lucide-react';
import { getWashCardByToken } from '@/lib/wash-card';
import { hasWashAccess, phoneLast4 } from '@/lib/wash-access';
import { formatDateOnly, formatKWD } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VerifyForm } from './verify-form';
import { AutoRefresh } from './auto-refresh';
import { SetLocation } from './set-location';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'كارت متابعة الغسيل',
  robots: { index: false, follow: false },
};

const STATUS_BADGE = {
  ACTIVE: { label: 'سارٍ', tone: 'ok' as const },
  PAUSED: { label: 'موقوف', tone: 'warn' as const },
  ENDED: { label: 'منتهٍ', tone: 'muted' as const },
};

const VISIT_STATUS_BADGE = {
  COMPLETED: { label: 'تمّت', tone: 'ok' as const },
  PLANNED: { label: 'مخطّطة', tone: 'accent' as const },
  SKIPPED: { label: 'تعذّرت', tone: 'warn' as const },
  BLOCKED: { label: 'غير مسدّد', tone: 'muted' as const },
};

const SKIP_REASON_LABEL: Record<string, string> = {
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

/**
 * كارت متابعة الغسيل للعميل — يفتحها من رسالة الواتساب أو بمسح الرمز،
 * بلا تسجيل دخول. والرابط وحده لا يكفي: يُسأل فاتحه عن آخر أربعة أرقام
 * من جوّال صاحب الاشتراك لضمان الخصوصية.
 */
export default async function PublicWashCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getWashCardByToken(token);

  if (!doc) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-sm text-center">
          <AlertCircle className="mx-auto size-9 text-[var(--text-2)]" />
          <p className="mt-4 text-[14px] text-[var(--text-1)]">
            هذا الرابط غير صالح. تواصل معنا لنرسل لك رابط متابعة الاشتراكات من جديد.
          </p>
        </div>
      </Shell>
    );
  }

  const guarded = Boolean(phoneLast4(doc.subscription.customer.phone));
  const open = !guarded || (await hasWashAccess(token));

  if (!open) {
    return (
      <Shell>
        <div className="mx-auto w-full max-w-sm pt-16">
          <div className="mb-8 flex justify-center">
            <Image
              src="/assets/logo.png"
              alt="هافركامب"
              width={140}
              height={48}
              priority
              className="invoice-logo h-12 w-auto object-contain"
            />
          </div>
          <div className="login-card rounded-[var(--radius-lg)] p-6">
            <h1 className="text-center text-lg font-bold text-[var(--text-0)]">كارت الغسيل</h1>
            <p className="mt-1.5 mb-6 text-center text-[13px] text-[var(--text-1)]">
              للاطمئنان على خصوصيتك، أكّد أنك صاحب الاشتراك
            </p>
            <VerifyForm token={token} />
          </div>
          <p className="mt-4 text-center text-[12px] text-[var(--text-2)]">
            لا تعرف الرقم المسجّل؟ تواصل معنا وسنساعدك.
          </p>
        </div>
      </Shell>
    );
  }

  const { subscription, current, history, shop } = doc;
  const subStatus = STATUS_BADGE[subscription.status];

  return (
    <Shell>
      <AutoRefresh />
      <div className="mx-auto max-w-xl space-y-6">
        {/*
          الشعار كلمةٌ عريضة لا مربّعاً: بجوار الرقم على شاشة الجوّال يركب
          أحدهما الآخر. فسطرٌ له وسطرٌ للرقم، ويجتمعان على الشاشة الواسعة.
        */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <Image
            src="/assets/logo.png"
            alt="هافركامب"
            width={140}
            height={40}
            priority
            className="invoice-logo h-8 w-auto max-w-[160px] object-contain"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[var(--text-2)]">متابعة الاشتراك</p>
              <h1
                className="tnum mt-0.5 text-xl font-bold whitespace-nowrap text-[var(--text-0)]"
                dir="ltr"
              >
                {subscription.code}
              </h1>
            </div>
            <Badge tone={subStatus.tone}>{subStatus.label}</Badge>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Car className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="text-[12px] text-[var(--text-2)]">السيارة</p>
                <p className="text-[14px] font-semibold text-[var(--text-0)]">
                  {subscription.vehicle.make} {subscription.vehicle.model}
                  {subscription.vehicle.year ? ` (${subscription.vehicle.year})` : ''}
                </p>
                <p className="tnum text-[12px] text-[var(--text-2)]" dir="ltr">
                  {subscription.vehicle.plateNo ? `لوحة ${subscription.vehicle.plateNo}` : 'بلا لوحة مسجّلة'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="text-[12px] text-[var(--text-2)]">موقع الخدمة</p>
                <p className="text-[13px] text-[var(--text-1)]">{subscription.location}</p>
                {subscription.locationNotes && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">{subscription.locationNotes}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-3 flex items-center justify-between">
            <span className="text-[13px] text-[var(--text-2)]">الاشتراك الشهري</span>
            <span className="tnum font-bold text-[var(--text-0)] text-base">
              {formatKWD(subscription.monthlyPrice)}
            </span>
          </div>
        </div>

        {/*
          عقدٌ منتهٍ لا يُطلب موقعه: الإجراء يردّ الطلب، فزرٌّ يُضغط ليُردّ
          كلّ مرة أسوأ من غيابه.
        */}
        {subscription.status !== 'ENDED' && (
          <SetLocation token={token} lat={subscription.lat} lng={subscription.lng} />
        )}

        {/*
          عقدٌ وُقّع ولم يُفتح شهره بعد. وصمتُ الصفحة هنا أسوأ من خبر:
          من دفع ولم يرَ شيئاً ظنّ أن اشتراكه ضاع.
        */}
        {!current && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-6 text-center">
            <CalendarClock className="mx-auto size-7 text-[var(--text-2)]" />
            <p className="mt-3 text-[14px] font-semibold text-[var(--text-0)]">
              لم يبدأ أول شهر من اشتراكك بعد
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--text-1)]">
              تظهر هنا غسلات الشهر ومواعيدها بمجرّد تفعيله.
            </p>
          </div>
        )}

        {current && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-accent">الشهر الحالي</p>
                <h2 className="text-lg font-bold text-[var(--text-0)]">{current.monthLabel}</h2>
              </div>
              <div className="text-end">
                <p className="text-[12px] text-[var(--text-2)]">ينتهي في</p>
                <p className="tnum text-[13px] font-semibold text-[var(--text-0)]">
                  {formatDateOnly(current.toDate)}
                </p>
              </div>
            </div>

            {!current.price.isFullyPaid ? (
              <div className="rounded-[var(--radius-md)] border border-warn/30 bg-warn/10 p-4 space-y-2 text-center">
                <ShieldAlert className="mx-auto size-6 text-warn" />
                <p className="text-[14px] font-semibold text-[var(--text-0)]">الاشتراك غير مسدّد لهذا الشهر</p>
                <p className="text-[13px] text-[var(--text-1)]">
                  تبدأ الجولات والغسلات بمجرد سداد قيمة الاشتراك (المبلغ المستحق:{' '}
                  <span className="tnum font-bold">{formatKWD(current.price.due)}</span>).
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    {current.counts.total > 0 && (
                      <>
                        <div
                          style={{ width: `${(current.counts.done / current.counts.total) * 100}%` }}
                          className="bg-ok transition-all"
                        />
                        <div
                          style={{ width: `${(current.counts.remaining / current.counts.total) * 100}%` }}
                          className="bg-accent transition-all"
                        />
                        <div
                          style={{ width: `${(current.counts.skipped / current.counts.total) * 100}%` }}
                          className="bg-warn transition-all"
                        />
                      </>
                    )}
                  </div>

                  {/*
                    أيامٌ مرّت قبل أن يُسدَّد الشهر تبقى مقفولة، فلا تُعدّ في
                    الثلاثة. وطرحُها من الشريط بلا كلمة يجعل الحساب لا يستقيم
                    في عين صاحبه — فتُقال باسمها.
                  */}
                  {current.counts.blocked > 0 && (
                    <p className="text-center text-[12px] text-[var(--text-2)]">
                      غسلات فاتت قبل سداد الاشتراك:{' '}
                      <span className="tnum font-semibold">{current.counts.blocked}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                      <p className="text-[11px] text-[var(--text-2)]">غسلات تمّت</p>
                      <p className="tnum mt-1 text-lg font-bold text-ok">{current.counts.done}</p>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                      <p className="text-[11px] text-[var(--text-2)]">غسلات متبقية</p>
                      <p className="tnum mt-1 text-lg font-bold text-accent">{current.counts.remaining}</p>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                      <p className="text-[11px] text-[var(--text-2)]">غسلات تعذّرت</p>
                      <p className="tnum mt-1 text-lg font-bold text-warn">{current.counts.skipped}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-[var(--line)] text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4 shrink-0 text-accent" />
                    <div>
                      <span className="text-[var(--text-2)]">غسلتك القادمة: </span>
                      <span className="tnum font-semibold text-[var(--text-0)]">
                        {current.nextWash ? formatDateOnly(current.nextWash.scheduledDate) : '—'}
                      </span>
                      {current.nextWash?.isMakeup && (
                        <span className="ms-1.5 text-[11px] font-medium text-accent">
                          (غسلة تعويضية عن {formatDateOnly(current.nextWash.dueDate)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Calendar className="size-4 shrink-0 text-[var(--text-2)]" />
                    <div>
                      <span className="text-[var(--text-2)]">يتجدد في: </span>
                      <span className="tnum font-semibold text-[var(--text-0)]">
                        {formatDateOnly(current.renewsOn)}
                      </span>
                      <span className="tnum text-[12px] text-[var(--text-2)] ms-1">
                        (متبقٍ: {current.daysLeft} يوم)
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {current && current.visits.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-0)]">جدول غسلات الشهر</h3>
            <div className="divide-y divide-[var(--line)]">
              {current.visits.map((v) => {
                const badge = VISIT_STATUS_BADGE[v.status];
                return (
                  <div key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-2 first:pt-0 last:pb-0">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="tnum text-[14px] font-semibold text-[var(--text-0)]">
                          {formatDateOnly(v.scheduledDate)}
                        </p>
                        {v.isMakeup && (
                          <span className="text-[11px] font-medium text-accent">
                            غسلة تعويضية عن {formatDateOnly(v.dueDate)}
                          </span>
                        )}
                      </div>
                      {v.status === 'COMPLETED' && v.completedAt && (
                        <p className="tnum text-[12px] text-[var(--text-2)]">
                          تمّت في: {completedTime(v.completedAt)}
                        </p>
                      )}
                      {v.status === 'SKIPPED' && v.skipReason && (
                        <p className="text-[12px] text-warn">
                          السبب: {SKIP_REASON_LABEL[v.skipReason] ?? v.skipReason}
                        </p>
                      )}
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-0)]">سجل الأشهر السابقة</h3>
            <div className="divide-y divide-[var(--line)]">
              {history.map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 text-[13px]">
                  <span className="font-medium text-[var(--text-1)]">{h.monthLabel}</span>
                  <span className="tnum text-[var(--text-2)]">
                    تمّت <strong className="text-[var(--text-0)]">{h.done}</strong> من {h.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {shop.phone && (
          <div className="pt-2 text-center text-[12px] text-[var(--text-2)]">
            لأي استفسار أو تعديل في المواعيد، تواصل معنا على:{' '}
            {/* الرقم يُعرض بفراغاته ويُطلب بلا فراغ — بعض المتصفّحات لا تقبلها في tel: */}
            <a
              href={`tel:${shop.phone.replace(/\s/g, '')}`}
              className="tnum font-semibold text-accent hover:underline"
              dir="ltr"
            >
              {shop.phone}
            </a>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-page invoice-public relative min-h-dvh px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="login-glow pointer-events-none absolute inset-0 -z-10"
      />
      {children}
    </main>
  );
}
