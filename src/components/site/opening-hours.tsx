'use client';

import { useSyncExternalStore } from 'react';

export interface HoursDay {
  /** 0=الأحد … 6=السبت — نفس ترقيم Date.getDay */
  day: number;
  label: string;
  time: string;
  closed: boolean;
}

/** الوقت لا يتغيّر من تلقاء نفسه خلال الزيارة — لا اشتراك يُلغى */
const subscribeNoop = () => () => {};

/** يوم وساعة الكويت مضغوطين في رقم واحد: يوم*100 + ساعة */
function getKuwaitStamp() {
  const kuwait = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuwait' }));
  return kuwait.getDay() * 100 + kuwait.getHours();
}

/**
 * جدول ساعات العمل مع تمييز اليوم الحالي وحالة مفتوح/مغلق.
 * يُحسب في المتصفح لا على الخادم: الصفحة مخزّنة، فحساب «اليوم» وقت
 * التصيير يُجمّد على لحظة البناء.
 */
export function OpeningHours({
  days,
  openHour,
  closeHour,
  todayLabel,
  title,
  texts,
}: {
  days: HoursDay[];
  openHour: number;
  closeHour: number;
  todayLabel: string;
  title: string;
  texts: { open: string; closed: string; opensIn: string; opensOn: string };
}) {
  // الخادم لا يعرف «الآن» بتوقيت الكويت، والصفحة مخزّنة — فنقرأه بعد الترطيب.
  // نُرجع رقماً مركّباً (يوم*100+ساعة) ليبقى المرجع ثابتاً بين النداءات.
  const stamp = useSyncExternalStore(subscribeNoop, getKuwaitStamp, () => -1);
  const now = stamp < 0 ? null : { day: Math.floor(stamp / 100), hour: stamp % 100 };

  const today = now?.day ?? -1;
  const todayRow = days.find((d) => d.day === today);
  const isOpen =
    now !== null && !!todayRow && !todayRow.closed && now.hour >= openHour && now.hour < closeHour;

  let status = '';
  if (now) {
    if (isOpen) status = texts.open;
    else if (todayRow && !todayRow.closed && now.hour < openHour) {
      status = `${texts.closed} · ${texts.opensIn.replace('{h}', String(openHour - now.hour))}`;
    } else {
      // أول يوم عمل قادم بعد اليوم
      const next =
        days.find((d) => !d.closed && d.day === (today + 1) % 7) ??
        days.find((d) => !d.closed);
      status = `${texts.closed} · ${texts.opensOn.replace('{d}', next?.label ?? '')}`;
    }
  }

  return (
    <div className="hours-card glass">
      <div className="hours-header">
        <h3>
          <span className="ico-wrap">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </span>
          <span>{title}</span>
        </h3>
        <span className={`hours-status-badge ${isOpen ? 'open' : status ? 'closed' : ''}`}>
          <span className="status-dot" />
          <span>{status || '…'}</span>
        </span>
      </div>

      <div className="hours-list">
        {days.map((d) => (
          <div
            key={d.day}
            className={`hours-row${d.day === today ? ' today' : ''}`}
            data-day={d.day}
          >
            <span className="hours-row-right">
              <span className="hours-day">
                <span className="day-dot" />
                <span>{d.label}</span>
              </span>
              {d.day === today && <span className="today-badge">{todayLabel}</span>}
            </span>
            {d.closed ? (
              <span className="hours-time" style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>
                {d.time}
              </span>
            ) : (
              <span className="hours-time" dir="ltr">
                {d.time}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
