import Link from 'next/link';
import type { Dictionary, Locale } from '@/lib/site-data';

/**
 * تذييل الموقع.
 * مدخل فريق العمل مفصول عن روابط الزوّار بفاصل رفيع: هو باب تشغيلي لا
 * وجهة تسويقية، فيبقى هادئاً حتى المرور عليه.
 */
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

  return (
    <footer className="footer" style={{ margin: '45px 0 0', padding: '45px 0 32px' }}>
      <div className="footer-row">
        <div className="copy">{t('footer.copy')}</div>

        <div className="links">
          <a href={`tel:${phone.replace(/\s/g, '')}`} dir="ltr">
            {phone}
          </a>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener"
            style={{ color: '#25D366' }}
          >
            {t('footer.wa')}
          </a>
          <a href="/terms.html">{t('footer.terms')}</a>
          <a href="/terms.html">{t('footer.warranty')}</a>
          <a href={instagram} target="_blank" rel="noopener">
            {t('footer.instagram')}
          </a>

          <span className="staff-sep" aria-hidden="true" />

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
      </div>
    </footer>
  );
}
