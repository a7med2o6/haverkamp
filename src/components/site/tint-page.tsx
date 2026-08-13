import Image from 'next/image';
import { getDictionary, getSettings, getTintPage, type Locale } from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { GalleryGrid } from './gallery';
import { BeforeAfter } from './before-after';

/** أيقونات المزايا الأربع — زخرفية ومرتبطة بترتيب ثابت في الترجمات */
const BENEFIT_ICONS = [
  <path
    key="heat"
    d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
  />,
  <path key="uv" d="M12 2L4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-4zM9 12l2 2 4-4" />,
  <path key="fuel" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  <path key="privacy" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM1 1l22 22" />,
];

function SectionHead({ tag, h2, body }: { tag: string; h2: string; body?: string }) {
  return (
    <div className="svc-sec-head">
      {tag && <div className="tag">{tag}</div>}
      {h2 && <Rich as="h2" html={h2} />}
      {body && (
        <p
          style={{
            fontSize: 15,
            color: 'var(--ink-1)',
            lineHeight: 1.6,
            maxWidth: 560,
            marginTop: 8,
          }}
        >
          {body}
        </p>
      )}
    </div>
  );
}

/** صفحة العازل الحراري — أقسامها لا تشبه بقية الخدمات فلها قالبها */
export async function TintPageView({ locale }: { locale: Locale }) {
  const [page, t, setting] = await Promise.all([
    getTintPage(locale),
    getDictionary(locale),
    getSettings(),
  ]);

  if (!page) return null;

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');
  const wa = `https://wa.me/${whatsapp}`;

  const { hero, benefits, beforeAfter, levels, brands, gallery, faq, cta } = page;

  return (
    <>
      {/* تنسيقات هذه الصفحة — كانت مضمّنة في tint.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/tint.css" />

      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} />

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

        {/* ═══════════ المزايا ═══════════ */}
        <div id="features" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={benefits.tag} h2={benefits.h2} />
          <div className="features-grid">
            {benefits.items.map((b, i) => (
              <div key={b.title} className="feature-card glass">
                <div className="feature-icon">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    {BENEFIT_ICONS[i]}
                  </svg>
                </div>
                <div className="feature-body">
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </div>
              </div>
            ))}
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

        {/* ═══════════ درجات التظليل ═══════════ */}
        <div id="levels" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={levels.tag} h2={levels.h2} body={levels.body} />

          <div className="tint-levels-grid">
            {levels.items.map((l) => (
              <div key={l.title} className={`tint-level-card glass ${l.className}`}>
                <div className="tint-window">
                  <div className="tint-window-bg" />
                  <div className="tint-window-overlay" />
                  <span className="tint-pct-badge">{l.pct}</span>
                </div>
                <div className="tint-level-body">
                  <h3>{l.title}</h3>
                  <p>{l.body}</p>
                  {l.badge && (
                    <span className="tint-level-max-badge">
                      <span>{l.badge}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="warranty-strip">
            {levels.warranty.map((w) => (
              <div key={w.label} className="warranty-card glass">
                <div className="warranty-num">{w.num}</div>
                <div className="warranty-label">{w.label}</div>
                <div className="warranty-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ العلامات المتوفرة ═══════════ */}
        <div id="brands" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={brands.tag} h2={brands.h2} />
          <div className="brands-grid">
            {brands.items.map((b) => (
              <div key={b.name} className="brand-card glass">
                <div className="brand-img-area">
                  <Image src={b.image} alt={b.name} width={300} height={160} loading="lazy" />
                </div>
                <div className="brand-info">
                  <div className="brand-name">{b.name}</div>
                  <div className="brand-origin">{b.origin}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ معرض الأعمال ═══════════ */}
        <div id="gallery" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={gallery.tag} h2={gallery.h2} />
          <GalleryGrid
            className="bento-grid"
            itemClassName="bento-item"
            imgClassName=""
            items={gallery.images.map((src, i) => ({
              id: `tint-${i}`,
              src,
              caption: `${page.name} — ${i + 1}`,
            }))}
          />
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
      </main>

      <SiteFooter
        t={t}
        locale={locale}
        phone={phone}
        whatsapp={whatsapp}
        instagram={instagram}
      />
    </>
  );
}
