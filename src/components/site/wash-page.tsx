import Image from 'next/image';
import { getDictionary, getSettings, getWashPage, type Locale } from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { GalleryGrid } from './gallery';

function SectionHead({ tag, h2, body }: { tag: string; h2: string; body?: string }) {
  return (
    <div className="svc-sec-head">
      {tag && <div className="tag">{tag}</div>}
      {h2 && <Rich as="h2" html={h2} />}
      {body && <Rich as="p" html={body} />}
    </div>
  );
}

/** صفحة الغسيل — باقات بأسعار وآراء عملاء خاصة بالخدمة */
export async function WashPageView({ locale }: { locale: Locale }) {
  const [page, t, setting] = await Promise.all([
    getWashPage(locale),
    getDictionary(locale),
    getSettings(),
  ]);

  if (!page) return null;

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');
  const wa = `https://wa.me/${whatsapp}`;

  const { hero, packages, why, gallery, reviews, cta } = page;

  return (
    <>
      {/* تنسيقات هذه الصفحة — كانت مضمّنة في wash.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/wash.css" />

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

            {hero.badges.length > 0 && (
              <div className="trust-badges">
                {hero.badges.map((b) => (
                  <span key={b} className="trust-badge">
                    <span>{b}</span>
                  </span>
                ))}
              </div>
            )}

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

        {/* ═══════════ الباقات ═══════════ */}
        <div id="packages" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={packages.tag} h2={packages.h2} body={packages.body} />

          <div className="packages-grid">
            {packages.items.map((pkg, i) => {
              const featured = i === 0;

              return (
                <div key={pkg.name} className={`pkg-card glass${featured ? ' featured' : ''}`}>
                  {featured && packages.badge && (
                    <div className="pkg-badge">{packages.badge}</div>
                  )}

                  <div className="pkg-header">
                    <div className="pkg-name">{pkg.name}</div>
                    {packages.note && <div className="pkg-note">{packages.note}</div>}
                    <div className="pkg-price">
                      <span className="amount">{pkg.price}</span>
                      <span className="currency">{packages.unit}</span>
                    </div>
                  </div>

                  <div className="pkg-divider" />

                  <ul className="pkg-features">
                    {pkg.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>

                  <a
                    href="/contactus.html"
                    className={`pkg-cta ${featured ? 'pkg-cta-primary' : 'pkg-cta-glass'}`}
                  >
                    {pkg.cta}
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════ لماذا نحن ═══════════ */}
        <div id="features" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={why.tag} h2={why.h2} body={why.body} />
          <div className="features-grid">
            {why.items.map((w) => (
              <div key={w.title} className="feature-card glass">
                <div className="feature-body">
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ معرض الأعمال ═══════════ */}
        <div id="gallery" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={gallery.tag} h2={gallery.h2} body={gallery.body} />
          <GalleryGrid
            className="bento-grid"
            itemClassName="bento-item glass"
            imgClassName=""
            items={gallery.images.map((src, i) => ({
              id: `wash-${i}`,
              src,
              caption: `${page.name} — ${i + 1}`,
            }))}
          />
        </div>

        {/* ═══════════ آراء العملاء ═══════════ */}
        <div id="reviews" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={reviews.tag} h2={reviews.h2} body={reviews.body} />
          <div className="reviews-grid">
            {reviews.items
              .filter((r) => r.text)
              .map((r) => (
                <div key={r.name} className="review-card glass">
                  <div className="review-stars">★★★★★</div>
                  <p className="review-text">{r.text}</p>
                  <div className="review-author">
                    <div className="review-avatar">{r.avatar}</div>
                    <div>
                      <div className="review-name">{r.name}</div>
                      <div className="review-car">{r.car}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ═══════════ دعوة للحجز ═══════════ */}
        <div className="svc-sec" id="cta" style={{ paddingTop: 0 }}>
          <div className="contact-shell">
            <div className="contact-info glass" style={{ padding: '48px 40px 40px' }}>
              <h3>{cta.h2 || t('contact.title')}</h3>
              {cta.body && <p>{cta.body}</p>}
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
