import Link from 'next/link';
import type { Dictionary, Locale } from '@/lib/site-data';

export function SiteFooter({
  t,
  locale,
  phone,
  whatsapp,
  instagram,
}: {
  t: Dictionary;
  locale: Locale;
  phone: string;
  whatsapp: string;
  instagram: string;
}) {
  const staffLabel = locale === 'en' ? 'Staff Portal' : 'بوابة الموظفين';
  const competitionsTitle = t(
    'footer.competitions',
    locale === 'en' ? 'Competitions' : 'المسابقات'
  );
  const competitionsHref = locale === 'en' ? '/en/competitions' : '/competitions';
  const informationTitle = t(
    'footer.information',
    locale === 'en' ? 'Information' : 'معلومات'
  );
  const contactTitle = t('nav.contact', locale === 'en' ? 'Contact' : 'تواصل معنا');

  return (
    <footer className="footer">
      <div className="footer-groups">
        <nav className="footer-group" aria-labelledby="footer-competitions-title">
          <h2 id="footer-competitions-title">{competitionsTitle}</h2>
          <ul>
            <li>
              <Link href={competitionsHref}>
                <span>{competitionsTitle}</span>
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="footer-group" aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title">{contactTitle}</h2>
          <ul>
            <li>
              <a href={`tel:${phone.replace(/\s/g, '')}`} dir="ltr">
                {phone}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-whatsapp"
              >
                {t('footer.wa')}
              </a>
            </li>
            <li>
              <a href={instagram} target="_blank" rel="noopener noreferrer">
                {t('footer.instagram')}
              </a>
            </li>
          </ul>
        </nav>

        <nav className="footer-group" aria-labelledby="footer-information-title">
          <h2 id="footer-information-title">{informationTitle}</h2>
          <ul>
            <li>
              <a href="/terms.html">{t('footer.terms')}</a>
            </li>
            <li>
              <a href="/terms.html">{t('footer.warranty')}</a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="footer-meta">
        <div className="copy">{t('footer.copy')}</div>

        {/* مدخل فريق العمل — لا يُفهرَس ولا يُتتبَّع من محركات البحث */}
        <Link href="/login" rel="nofollow" className="staff-login" aria-label={staffLabel}>
          <span className="staff-ico" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 118 0v4" />
            </svg>
          </span>
          <span className="staff-text">{staffLabel}</span>
          <span className="staff-arrow" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>
    </footer>
  );
}
