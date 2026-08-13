import Image from 'next/image';
import { getBrandPage, getDictionary, getSettings, type Locale } from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { GalleryGrid } from './gallery';

function Check() {
  return (
    <span className="check">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function SectionHead({ tag, h2, body }: { tag: string; h2: string; body?: string }) {
  return (
    <div className="svc-sec-head">
      {tag && <div className="tag">{tag}</div>}
      {h2 && <Rich as="h2" html={h2} />}
      {body && <Rich as="p" html={body} />}
    </div>
  );
}

/**
 * قالب صفحة الماركة (هافركامب/كلايف/أيرون).
 * الثلاثة يتشاركون نفس الأقسام وأسماء الأصناف، لكن لكل صفحة ملف CSS خاص
 * لأن كل ماركة تُعيد تعريف نفس الأصناف بألوانها — دمجها في ملف واحد يكسر
 * شكل اثنتين منها.
 */
export async function BrandPageView({ slug, locale }: { slug: string; locale: Locale }) {
  const [page, t, setting] = await Promise.all([
    getBrandPage(slug, locale),
    getDictionary(locale),
    getSettings(),
  ]);

  if (!page) return null;

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');
  const wa = `https://wa.me/${whatsapp}`;

  const { hero, about, specs, finish, gallery, packages, faq, cta } = page;
  const hasFaq = faq.items.some((f) => f.q);

  return (
    <>
      {/* تنسيقات خاصة بهذه الماركة — كانت مضمّنة في صفحتها الثابتة */}
      <link rel="stylesheet" href={page.cssHref} />

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

            <div className="svc-hero-actions" style={{ marginTop: 28 }}>
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

          <div className="svc-hero-logo-panel glass">
            <Image
              src={hero.logo}
              alt={page.name}
              width={260}
              height={120}
              className="hero-brand-logo"
              style={hero.blendLogo ? { mixBlendMode: 'multiply' } : undefined}
            />
            <div className="hero-brand-badge">
              <span className="flag">{hero.flag}</span>
              <span>{hero.badge}</span>
            </div>
            {hero.bsub && <p className="hero-brand-subtitle">{hero.bsub}</p>}
          </div>
        </div>

        {/* ═══════════ نبذة ═══════════ */}
        <div id="about" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={about.tag} h2={about.h2} body={about.body} />

          <div className="about-block">
            <div
              className="about-text glass"
              style={{ padding: '32px 36px', borderRadius: 'var(--r-xl)' }}
            >
              {about.paragraphs.map((p, i) => (
                <Rich key={i} as="p" html={p} style={i > 0 ? { marginTop: 16 } : undefined} />
              ))}
            </div>

            <div className="about-stat-row">
              {about.stats.map((s) => (
                <div key={s.label} className="about-stat glass">
                  <div className="about-stat-num">{s.num}</div>
                  <div className="about-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════ المواصفات ═══════════ */}
        <div id="specs" className="svc-sec" style={{ paddingTop: 0 }}>
          <SectionHead tag={specs.tag} h2={specs.h2} />
          <div className="specs-grid">
            {specs.items
              .filter((s) => s.value || s.label)
              .map((s) => (
                <div key={s.label} className="spec-card glass">
                  <div className="spec-value">{s.value}</div>
                  <div className="spec-label">{s.label}</div>
                </div>
              ))}
          </div>
        </div>

        {/* ═══════════ أنواع الحماية ═══════════ */}
        {finish && (
          <div id="finish-types" className="svc-sec" style={{ paddingTop: 0 }}>
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
        )}

        {/* ═══════════ معرض الأعمال ═══════════ */}
        <div className="svc-sec" id="gallery" style={{ paddingTop: 0 }}>
          <SectionHead tag={gallery.tag} h2={gallery.h2} body={gallery.body} />
          {/* الصور في bento تُنسَّق عبر `.bento-item img` لا عبر صنف عليها */}
          <GalleryGrid
            className="bento-grid"
            itemClassName="bento-item glass"
            imgClassName=""
            items={gallery.images.map((src, i) => ({
              id: `${slug}-${i}`,
              src,
              caption: `${page.name} — ${i + 1}`,
            }))}
          />
        </div>

        {/* ═══════════ الباقات ═══════════ */}
        <div className="svc-sec" id="packages" style={{ paddingTop: 0 }}>
          <SectionHead tag={packages.tag} h2={packages.h2} body={packages.body} />

          <div className={packages.style === 'head' ? 'pkg-grid' : 'packages-grid'}>
            {packages.items.map((pkg, i) => {
              const featured = i === 0;

              return (
                <div
                  key={pkg.name}
                  className={
                    packages.style === 'head'
                      ? `pkg-card glass${featured ? ' featured' : ''}`
                      : `pkg-card glass${featured ? ' pkg-card--platinum' : ''}`
                  }
                >
                  {featured && packages.badge && packages.style === 'head' && (
                    <span className="pkg-popular-badge">{packages.badge}</span>
                  )}
                  {featured && packages.badge && packages.style === 'tier' && (
                    <div className="pkg-badge">
                      <span>{packages.badge}</span>
                    </div>
                  )}

                  {packages.style === 'head' ? (
                    <div className="pkg-head">
                      <div className="pkg-name">{pkg.name}</div>
                      <div className="pkg-price">
                        <span className="pkg-price-num">{pkg.price}</span>
                        <span className="pkg-price-unit">{packages.unit}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {pkg.tier && <div className="pkg-tier">{pkg.tier}</div>}
                      <div className="pkg-name">{pkg.name}</div>
                      <div className="pkg-price">
                        {pkg.price}{' '}
                        <span
                          style={{ fontSize: 20, fontWeight: 400, color: 'var(--ink-2)' }}
                        >
                          {packages.unit}
                        </span>
                      </div>
                      {packages.note && <div className="pkg-price-note">{packages.note}</div>}
                    </>
                  )}

                  <div className="pkg-divider" />

                  <ul className="pkg-features">
                    {pkg.features.map((f) => (
                      <li key={f}>
                        <Check />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={`${wa}?text=${encodeURIComponent(`مهتم بـ${pkg.name} — ${page.name}، ممكن التفاصيل؟`)}`}
                    target="_blank"
                    rel="noopener"
                    className={packages.style === 'head' ? 'btn btn-primary' : 'pkg-wa-btn'}
                    style={packages.style === 'head' ? { justifyContent: 'center' } : undefined}
                  >
                    {packages.cta}
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════ الأسئلة الشائعة ═══════════ */}
        {hasFaq && (
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
        )}

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
