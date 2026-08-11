import Image from 'next/image';
import {
  getDictionary,
  getServicePage,
  getSettings,
  type Locale,
} from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';

/**
 * قالب صفحة الخدمة — يعرض القسم فقط إن وُجد محتواه في الترجمات،
 * فتصلح الصفحة لخدمات ذات أقسام مختلفة دون تفريع قالب لكل خدمة.
 */
export async function ServicePageView({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const [page, t, setting] = await Promise.all([
    getServicePage(slug, locale),
    getDictionary(locale),
    getSettings(),
  ]);

  if (!page) return null;

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');

  const hasSteps = page.steps.items.some((s) => s.title);
  const hasFeatures = page.features.items.some((f) => f.title);
  const hasFaq = page.faq.items.some((f) => f.q);

  return (
    <>
      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} />

      <main className="shell">
        {/* ═══════════ الهيرو ═══════════ */}
        <section className="hero" style={{ padding: '60px 0 40px' }}>
          <div className="hero-top" style={{ margin: '0 0 36px' }}>
            <div className="hero-text">
              {page.hero.tag && (
                <div className="tag" style={{ marginBottom: 14 }}>
                  {page.hero.tag}
                </div>
              )}
              <Rich as="h1" html={page.hero.h1} />
              {page.hero.sub && <Rich as="p" className="hero-tagline" html={page.hero.sub} />}
              {page.hero.body && <Rich as="p" className="lede" html={page.hero.body} />}

              {page.hero.badges.length > 0 && (
                <div className="hero-credentials">
                  {page.hero.badges.map((b) => (
                    <div key={b} className="cred-row" style={{ maxWidth: 420, width: '100%' }}>
                      <span className="cred-mark">●</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener"
                className="nav-cta"
                style={{ marginTop: 26, display: 'inline-flex' }}
              >
                {page.cta.book || t('contact.wa.btn')}
              </a>
            </div>

            <div className="hero-logo-side">
              <Image
                src={page.hero.image}
                alt={page.name}
                width={720}
                height={520}
                priority
                className="hero-logo-img"
                style={{ borderRadius: 24, objectFit: 'cover' }}
              />
            </div>
          </div>
        </section>

        {/* ═══════════ خطوات التنفيذ ═══════════ */}
        {hasSteps && (
          <section className="section" id="steps" style={{ padding: '45px 0' }}>
            <div className="section-head">
              <div>
                <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                  {page.steps.tag}
                </div>
                <h2>{page.steps.h2}</h2>
              </div>
              {page.steps.body && <p className="desc">{page.steps.body}</p>}
            </div>

            <div className="why-grid">
              {page.steps.items
                .filter((s) => s.title)
                .map((s) => (
                  <div key={s.num} className="why-card glass">
                    <div className="why-num">{s.num}</div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ═══════════ لماذا نحن ═══════════ */}
        {hasFeatures && (
          <section className="section" id="features" style={{ padding: '45px 0' }}>
            <div className="section-head">
              <div>
                <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                  {page.features.tag}
                </div>
                <h2>{page.features.h2}</h2>
              </div>
              {page.features.body && <p className="desc">{page.features.body}</p>}
            </div>

            <div className="why-grid">
              {page.features.items
                .filter((f) => f.title)
                .map((f) => (
                  <div key={f.num} className="why-card glass">
                    <div className="why-icon">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M12 2L4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-4z" />
                        <path d="M9 12l2 2 4-4" strokeWidth="1.8" />
                      </svg>
                    </div>
                    <div className="why-num">{f.num}</div>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ═══════════ معرض الأعمال ═══════════ */}
        <section className="section" id="gallery" style={{ padding: '45px 0' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {page.gallery.tag}
              </div>
              <h2>{page.gallery.h2}</h2>
            </div>
            {page.gallery.body && <p className="desc">{page.gallery.body}</p>}
          </div>

          <div className="services-grid">
            {page.gallery.images.map((src, i) => (
              <div key={src} className="service-card glass" style={{ cursor: 'default' }}>
                <div className="img-slot">
                  <Image
                    src={src}
                    alt={`${page.name} — ${i + 1}`}
                    width={520}
                    height={340}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ الأسئلة الشائعة ═══════════ */}
        {hasFaq && (
          <section className="section" id="faq" style={{ padding: '45px 0' }}>
            <div className="section-head">
              <div>
                <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                  {page.faq.tag}
                </div>
                <h2>{page.faq.h2}</h2>
              </div>
            </div>

            <div className="faq-list">
              {page.faq.items
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
          </section>
        )}

        {/* ═══════════ دعوة للحجز ═══════════ */}
        <section className="section" id="cta" style={{ padding: '45px 0 20px' }}>
          <div className="contact-shell">
            <div className="contact-info glass" style={{ padding: '48px 40px 40px' }}>
              <h3>{page.cta.h2 || t('contact.title')}</h3>
              {page.cta.body && <p>{page.cta.body}</p>}
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener"
                className="nav-cta"
                style={{ marginTop: 26, display: 'inline-flex' }}
              >
                {page.cta.book || t('contact.wa.btn')}
              </a>
            </div>
          </div>
        </section>
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
