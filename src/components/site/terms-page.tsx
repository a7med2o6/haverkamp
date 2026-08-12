import { getDictionary, getSettings, type Locale } from '@/lib/site-data';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';

/** بند في قائمة — النقطة عنصر تزييني يرسمه css/terms.css */
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span className="bullet" />
      <span>{children}</span>
    </li>
  );
}

/** بنود القسم الأول — مرقّمة في الترجمات terms.s1.li1 … li9 */
const CONDITION_KEYS = Array.from({ length: 9 }, (_, i) => `terms.s1.li${i + 1}`);

const WARRANTIES = [
  { title: 'terms.w1.title', items: ['terms.w1.li1', 'terms.w1.li2'], note: 'terms.w1.note' },
  { title: 'terms.w2.title', items: ['terms.w2.li1', 'terms.w2.li2'], note: null },
];

function TermsCard({
  num,
  title,
  id,
  children,
}: {
  num: string;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="terms-section" id={id}>
      <div className="terms-card glass">
        <div className="terms-card-head">
          <span className="terms-card-num">{num}</span>
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * صفحة البنود والشروط.
 * كل النصوص من مفاتيح terms.* في جدول الترجمات — تُحرَّر من
 * «نصوص الموقع» في اللوحة وتظهر هنا فوراً.
 */
export async function TermsPageView({ locale }: { locale: Locale }) {
  const [t, setting] = await Promise.all([getDictionary(locale), getSettings()]);

  return (
    <>
      {/* تنسيقات خاصة بهذه الصفحة — كانت مضمّنة في terms.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/terms.css" />

      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} />

      <main className="terms-page">
        <div className="terms-hero">
          <div className="tag">{t('terms.hero.tag')}</div>
          <h1>{t('terms.hero.h1')}</h1>
          <p>{t('terms.hero.p')}</p>

          {/* الصفحة القديمة كانت تضع هذه الروابط في شريط التنقّل العلوي —
              نقلناها للصفحة نفسها حتى يبقى الشريط موحّداً بين كل الصفحات */}
          <nav className="terms-jump" aria-label={t('terms.hero.h1')}>
            <a href="#terms-conditions">{t('terms.nav.terms')}</a>
            <a href="#post-install">{t('terms.nav.post')}</a>
            <a href="#warranty">{t('terms.nav.warranty')}</a>
          </nav>
        </div>

        <TermsCard num="01" id="terms-conditions" title={t('terms.s1.h2')}>
          <ul className="terms-list">
            {CONDITION_KEYS.map((k) => (
              <Bullet key={k}>{t(k)}</Bullet>
            ))}
          </ul>
        </TermsCard>

        <TermsCard num="02" id="post-install" title={t('terms.s2.h2')}>
          <div className="terms-sub">
            <div className="terms-sub-block">
              <div className="sub-label">{t('terms.s2a.lbl')}</div>
              <p>{t('terms.s2a.p')}</p>
            </div>
            <div className="terms-sub-block">
              <div className="sub-label">{t('terms.s2b.lbl')}</div>
              <p>{t('terms.s2b.p')}</p>
            </div>
          </div>
        </TermsCard>

        <TermsCard num="03" id="warranty" title={t('terms.s3.h2')}>
          <div className="warranty-grid">
            {WARRANTIES.map((w) => (
              <div className="warranty-block" key={w.title}>
                <div className="w-title">{t(w.title)}</div>
                <ul>
                  {w.items.map((k) => (
                    <Bullet key={k}>{t(k)}</Bullet>
                  ))}
                </ul>
                {w.note && <div className="note">{t(w.note)}</div>}
              </div>
            ))}
          </div>
        </TermsCard>
      </main>

      <SiteFooter
        t={t}
        locale={locale}
        phone={setting('contact.phone', '+965 5111 1154')}
        whatsapp={setting('contact.whatsapp', '96551111154')}
        instagram={setting('social.instagram', 'https://instagram.com/haverkampkw')}
      />
    </>
  );
}
