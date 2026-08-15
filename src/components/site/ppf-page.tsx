import Image from 'next/image';
import Link from 'next/link';
import { getDictionary, getPpfPage, getSettings, type Locale } from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { BeforeAfter } from './before-after';

function SectionHead({ tag, h2, body }: { tag: string; h2: string; body?: string }) {
  return (
    <div className="svc-sec-head">
      {tag && <div className="tag">{tag}</div>}
      {h2 && <Rich as="h2" html={h2} />}
      {body && <Rich as="p" html={body} />}
    </div>
  );
}

/** صفحة حماية البدي — تجمع أنواع الحماية والعلامات ومدخل استوديو الألوان */
export async function PpfPageView({ locale }: { locale: Locale }) {
  const [page, t, setting] = await Promise.all([
    getPpfPage(locale),
    getDictionary(locale),
    getSettings(),
  ]);

  if (!page) return null;

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');
  const wa = `https://wa.me/${whatsapp}`;

  const { hero, beforeAfter, finish, colorStudio, brands, faq, cta } = page;

  return (
    <>
      {/* تنسيقات هذه الصفحة — كانت مضمّنة في protication.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/protication.css" />

      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} links={page.nav} />

      <main className="svc-page">
        {/* ═══════════ الهيرو ═══════════ */}
        <div className="svc-hero">
          <div className="svc-hero-text">
            {hero.tag && <div className="tag">{hero.tag}</div>}
            <Rich as="h1" html={hero.h1} />
            {hero.sub && <p className="subtitle">{hero.sub}</p>}
            {hero.body && <Rich as="p" html={hero.body} />}

            <div className="svc-hero-actions">
              <a href="/contactus.html" className="btn btn-primary">
                {t('svc.btn.book')}
              </a>
              <a
                href={wa}
                target="_blank"
                rel="noopener"
                className="btn btn-glass"
                style={{ color: '#25D366', borderColor: 'rgba(37,211,102,.35)' }}
              >
                {t('svc.btn.wa')}
              </a>
            </div>
          </div>

          <div className="svc-hero-img glass">
            <Image src={hero.image} alt={page.name} width={900} height={620} priority />
          </div>
        </div>

        {/* ═══════════ قبل وبعد ═══════════ */}
        <div id="before-after" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={beforeAfter.tag} h2={beforeAfter.h2} body={beforeAfter.body} />
          <BeforeAfter
            before={beforeAfter.before}
            after={beforeAfter.after}
            beforeLabel={beforeAfter.beforeLabel}
            afterLabel={beforeAfter.afterLabel}
            ariaLabel={beforeAfter.h2}
          />
        </div>

        {/* ═══════════ أنواع الحماية ═══════════ */}
        <div id="finish-types" className="svc-sec">
          <SectionHead tag={finish.tag} h2={finish.h2} />
          <div className="finish-grid">
            {finish.items.map((f) => (
              <div key={f.title} className="finish-card glass">
                <Image
                  src={f.image}
                  alt={f.title}
                  width={520}
                  height={340}
                  loading="lazy"
                  className="finish-img"
                />
                <div className="finish-body">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ استوديو الألوان ═══════════ */}
        <div
          id="color-studio"
          className="svc-sec"
          style={{ paddingTop: 0, paddingBottom: 48 }}
        >
          <div className="csc-wrap glass">
            <div className="csc-visual">
              <Image
                src={colorStudio.image}
                alt={colorStudio.h3}
                width={900}
                height={600}
                loading="lazy"
                className="csc-img"
              />
            </div>
            <div className="csc-body">
              <div className="csc-eyebrow">{colorStudio.eyebrow}</div>
              <h3 className="csc-title">{colorStudio.h3}</h3>
              <p className="csc-desc">{colorStudio.body}</p>
              <a href={colorStudio.href} className="btn btn-primary csc-btn">
                <span>{colorStudio.btn}</span>
              </a>
            </div>
          </div>
        </div>

        {/* ═══════════ العلامات المتوفرة ═══════════ */}
        <div id="brands" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={brands.tag} h2={brands.h2} />
          <div className="brands-grid">
            {brands.items.map((b) => (
              <Link key={b.name} href={b.href} className="brand-card glass">
                <div className="brand-img-area">
                  <Image src={b.image} alt={b.name} width={300} height={160} loading="lazy" />
                </div>
                <div className="brand-info">
                  <div className="brand-name">{b.name}</div>
                  <div className="brand-origin">{b.origin}</div>
                  <div className="brand-more">{brands.more}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══════════ الأسئلة الشائعة ═══════════ */}
        <div id="faq" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={faq.tag} h2={faq.h2} />
          <div className="faq-list">
            {faq.items
              .filter((f) => f.q)
              .map((f) => (
                <details key={f.q} className="faq-item glass">
                  <summary>
                    <span>{f.q}</span>
                    <span className="plus">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <div className="answer">{f.a}</div>
                </details>
              ))}
          </div>
        </div>

        {/* ═══════════ دعوة للحجز ═══════════ */}
        <div className="svc-sec" id="cta" style={{ paddingTop: 0 }}>
          <div className="contact-shell">
            <div className="contact-info glass" style={{ padding: '48px 40px 40px' }}>
              <h3>{cta.h2 || t('contact.title')}</h3>
              <a
                href={wa}
                target="_blank"
                rel="noopener"
                className="nav-cta"
                style={{ marginTop: 26, display: 'inline-flex' }}
              >
                {cta.book || t('contact.wa.btn')}
              </a>
            </div>
          </div>
        </div>
        <SiteFooter
          t={t}
          locale={locale}
          phone={phone}
          whatsapp={whatsapp}
          instagram={instagram}
        />
      </main>
    </>
  );
}
