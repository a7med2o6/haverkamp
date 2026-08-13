'use client';

import { useState, useTransition } from 'react';
import { submitBooking } from '@/app/(site)/actions';
import type { Locale } from '@/lib/site-data';

interface Labels {
  name: string;
  phone: string;
  service: string;
  car: string;
  notes: string;
  submit: string;
  phName: string;
  phCar: string;
  phNotes: string;
}

/**
 * نموذج طلب الحجز.
 * يحفظ الطلب في قاعدة البيانات ليظهر فوراً في "الحجوزات" باللوحة،
 * ثم يفتح واتساب بالرسالة نفسها — فلا تفقد الإدارة القناة التي اعتادتها.
 */
export function ContactForm({
  locale,
  whatsapp,
  labels,
  services,
}: {
  locale: Locale;
  whatsapp: string;
  labels: Labels;
  services: Array<{ slug: string; name: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [values, setValues] = useState({
    name: '',
    phone: '',
    serviceSlug: services[0]?.slug ?? '',
    car: '',
    notes: '',
    preferredAt: '',
    website: '', // مصيدة البوتات
  });

  function set<K extends keyof typeof values>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function whatsappMessage() {
    const serviceName =
      services.find((s) => s.slug === values.serviceSlug)?.name ?? values.serviceSlug;
    const line = '━━━━━━━━━━━━━━━━';

    if (locale === 'en') {
      return [
        'New website enquiry 🚗',
        line,
        `👤 Name: ${values.name}`,
        `📞 Phone: ${values.phone}`,
        `🔧 Service: ${serviceName}`,
        values.car && `🚘 Car: ${values.car}`,
        values.preferredAt && `📅 Preferred: ${values.preferredAt}`,
        values.notes && `📝 Notes: ${values.notes}`,
        line,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      'طلب جديد من الموقع 🚗',
      line,
      `👤 الاسم: ${values.name}`,
      `📞 الجوال: ${values.phone}`,
      `🔧 الخدمة: ${serviceName}`,
      values.car && `🚘 السيارة: ${values.car}`,
      values.preferredAt && `📅 الموعد المفضّل: ${values.preferredAt}`,
      values.notes && `📝 ملاحظات: ${values.notes}`,
      line,
    ]
      .filter(Boolean)
      .join('\n');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    // نفتح النافذة قبل await حتى لا يحجبها المتصفح كنافذة غير ناتجة عن نقرة
    const win = window.open('', '_blank');

    startTransition(async () => {
      const res = await submitBooking(values);

      if (!res.ok) {
        win?.close();
        setStatus({ ok: false, msg: res.error });
        return;
      }

      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(whatsappMessage())}`;
      if (win) win.location.href = url;
      else window.location.href = url;

      setStatus({
        ok: true,
        msg:
          locale === 'en'
            ? `Request received${res.code ? ` — ref ${res.code}` : ''}. We’ll confirm shortly.`
            : `تم استلام طلبك${res.code ? ` — رقم ${res.code}` : ''}. سنتواصل معك للتأكيد.`,
      });

      setValues((v) => ({ ...v, name: '', phone: '', car: '', notes: '', preferredAt: '' }));
    });
  }

  return (
    <form className="contact-form glass" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="cf-name">{labels.name}</label>
        <input
          id="cf-name"
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={labels.phName}
          maxLength={80}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cf-phone">{labels.phone}</label>
        <input
          id="cf-phone"
          type="tel"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+965 5xx xxx xxx"
          dir="ltr"
          maxLength={20}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cf-service">{labels.service}</label>
        <select
          id="cf-service"
          value={values.serviceSlug}
          onChange={(e) => set('serviceSlug', e.target.value)}
        >
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cf-date">
          {locale === 'en' ? 'Preferred date (optional)' : 'الموعد المفضّل (اختياري)'}
        </label>
        <input
          id="cf-date"
          type="date"
          value={values.preferredAt}
          onChange={(e) => set('preferredAt', e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          dir="ltr"
        />
      </div>

      <div className="field">
        <label htmlFor="cf-car">{labels.car}</label>
        <input
          id="cf-car"
          type="text"
          value={values.car}
          onChange={(e) => set('car', e.target.value)}
          placeholder={labels.phCar}
          maxLength={80}
        />
      </div>

      <div className="field">
        <label htmlFor="cf-notes">{labels.notes}</label>
        <textarea
          id="cf-notes"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={labels.phNotes}
          maxLength={500}
        />
      </div>

      {/*
        مصيدة البوتات — مخفية عن البشر وقارئات الشاشة.
        الاسم متعمَّد غير مألوف: حقل باسم website أو url تملؤه التعبئة
        التلقائية في المتصفح، فيُصنَّف زائرٌ حقيقي كبوت ويضيع حجزه.
      */}
      <input
        type="text"
        name="hk-ref-src"
        value={values.website}
        onChange={(e) => set('website', e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
      />

      {status && (
        <p
          role="status"
          style={{
            margin: '0 0 12px',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            border: `1px solid ${status.ok ? 'rgba(52,211,153,.35)' : 'rgba(248,113,113,.35)'}`,
            background: status.ok ? 'rgba(52,211,153,.10)' : 'rgba(248,113,113,.10)',
            color: status.ok ? '#34d399' : '#f87171',
          }}
        >
          {status.msg}
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        <span>
          {pending ? (locale === 'en' ? 'Sending…' : 'جارٍ الإرسال…') : labels.submit}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>
    </form>
  );
}
