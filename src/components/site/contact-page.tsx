import Image from 'next/image';
import Link from 'next/link';
import { getContactPage, getDictionary, type Locale } from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { OpeningHours } from './opening-hours';

function Arrow() {
  return (
    <div className="tile-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </div>
  );
}

function Tile({
  href,
  external,
  iconClass,
  icon,
  label,
  value,
}: {
  href: string;
  external?: boolean;
  iconClass?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      className="tile glass"
      {...(external ? { target: '_blank', rel: 'noopener' } : {})}
    >
      <div className={`tile-icon${iconClass ? ` ${iconClass}` : ''}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          {icon}
        </svg>
      </div>
      <div className="tile-body">
        <div className="tile-label">{label}</div>
        <div className="tile-value en">{value}</div>
      </div>
      <Arrow />
    </a>
  );
}

/** صفحة التواصل — بيانات الاتصال وساعات العمل والخريطة */
export async function ContactPageView({ locale }: { locale: Locale }) {
  const [page, t] = await Promise.all([getContactPage(locale), getDictionary(locale)]);

  const { tiles, hours, map } = page;
  const home = locale === 'en' ? '/en' : '/';
  const igHandle = tiles.instagram.value.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@');

  return (
    <>
      {/* تنسيقات هذه الصفحة — كانت مضمّنة في contactus.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/contactus.css" />

      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} />

      <main className="contact-page">
        <Link href={home} className="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span>{page.back}</span>
        </Link>

        {/* ═══════════ بطاقة التعريف ═══════════ */}
        <div className="profile-card glass">
          <div className="profile-cover">
            <Image src="/assets/cover.jpeg" alt={page.siteName} width={1200} height={400} priority />
          </div>
          <div className="profile-body">
            <div className="profile-avatar-sq">
              <Image src="/assets/profile.png" alt={page.siteName} width={160} height={160} />
            </div>
            <h1 className="profile-name">
              {page.siteName}
              <span className="verified-badge" title="موثّق">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
            </h1>
            <div className="profile-tag">
              <span className="dot" />
              <span>{page.status}</span>
            </div>
            <Rich as="p" className="profile-bio" html={page.bio} />
          </div>
        </div>

        {/* ═══════════ وسائل التواصل ═══════════ */}
        <div className="contact-tiles">
          <Tile
            href={`tel:${tiles.phone.value.replace(/\s/g, '')}`}
            label={tiles.phone.label}
            value={tiles.phone.value}
            icon={
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            }
          />

          <Tile
            href={`https://wa.me/${tiles.whatsapp.value}`}
            external
            iconClass="wa"
            label={tiles.whatsapp.label}
            value={tiles.phone.value}
            icon={
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            }
          />

          <Tile
            href={tiles.instagram.value}
            external
            iconClass="ig"
            label={tiles.instagram.label}
            value={igHandle}
            icon={
              <>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
              </>
            }
          />

          <Tile
            href={tiles.location.href}
            external
            iconClass="loc"
            label={tiles.location.label}
            value={tiles.location.value}
            icon={
              <>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </>
            }
          />
        </div>

        {/* ═══════════ ساعات العمل ═══════════ */}
        <OpeningHours
          days={hours.days}
          openHour={hours.openHour}
          closeHour={hours.closeHour}
          todayLabel={hours.todayLabel}
          title={hours.title}
          texts={hours.texts}
        />

        {/* ═══════════ الخريطة ═══════════ */}
        <div className="map-card glass">
          <div className="map-header">
            <h3>
              <span className="ico-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span>{map.title}</span>
            </h3>
            <a href={map.href} target="_blank" rel="noopener" className="map-open">
              <span>{map.open}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
          </div>

          <iframe
            className="map-frame"
            src={map.embed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={map.title}
          />

          <div className="map-address">{map.address}</div>
        </div>

        <div className="footer-note">{t('footer.copy')}</div>
      </main>
    </>
  );
}
