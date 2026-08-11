import Link from 'next/link';
import Image from 'next/image';
import type { Dictionary, Locale } from '@/lib/site-data';

/** شريط التنقّل العلوي — نفس بنية الموقع الثابت ليعمل معه nav.js */
export function SiteNav({ t, locale }: { t: Dictionary; locale: Locale }) {
  const home = locale === 'en' ? '/en' : '/';
  const other = locale === 'en' ? '/' : '/en';

  return (
    <div className="nav-wrap">
      <nav className="nav glass">
        <div className="nav-brand">
          <Link href={home}>
            <Image
              src="/assets/logo.png"
              alt="هافركامب — HAVERKAMP"
              width={132}
              height={38}
              priority
              className="brand-mark"
            />
          </Link>
        </div>

        <div className="nav-links">
          <a href={`${home}#services`}>{t('nav.services')}</a>
          <a href={`${home}#gallery`}>{t('nav.gallery')}</a>
          <a href="/contactus.html">{t('nav.contact')}</a>
          <a href={`${home}#testimonials`}>{t('nav.testimonials')}</a>
          <a href={`${home}#why`}>{t('nav.why')}</a>
          <a href="/terms.html">{t('nav.terms')}</a>
        </div>

        <a href="/contactus.html" className="nav-cta">
          {t('nav.cta')}
        </a>

        {/* تبديل اللغة صار تنقّلاً بين مسارين ليُفهرَس كلٌّ منهما */}
        <Link
          href={other}
          className="lang-btn"
          aria-label={locale === 'ar' ? 'English' : 'العربية'}
          title={locale === 'ar' ? 'English' : 'العربية'}
        >
          {locale === 'ar' ? '🇬🇧' : '🇰🇼'}
        </Link>

        <button className="nav-burger" id="nav-burger" aria-label="القائمة" aria-expanded="false">
          <span />
          <span />
          <span />
        </button>
      </nav>
      <div className="nav-drawer" id="nav-drawer" />
    </div>
  );
}
