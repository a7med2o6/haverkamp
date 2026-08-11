import Link from 'next/link';
import type { Dictionary, Locale } from '@/lib/site-data';

/** تذييل الموقع — يتضمّن مدخل فريق العمل إلى لوحة التحكم */
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

          {/* مدخل فريق العمل — لا يُفهرَس ولا يُتتبَّع من محركات البحث */}
          <Link href="/login" rel="nofollow" className="staff-login">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <path d="M10 17l5-5-5-5M15 12H3" />
            </svg>
            {locale === 'en' ? 'Staff Login' : 'دخول الموظفين'}
          </Link>
        </div>
      </div>
    </footer>
  );
}
