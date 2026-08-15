import Image from 'next/image';
import { getDictionary, getServicePage, getSettings, type Locale } from '@/lib/site-data';
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

/**
 * قالب صفحة الخدمة (الجام/البوليش/الصبغ).
 * البنية والأصناف مطابقة لصفحات الموقع الثابت (svc-page / svc-hero / svc-sec)
 * وتنسيقاتها في css/service.css — يُعرض القسم فقط إن وُجد محتواه في الترجمات
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
  const wa = `https://wa.me/${whatsapp}`;

  const { hero, steps, features, gallery, faq, cta } = page;
  const hasSteps = steps.items.some((s) => s.title);
  const hasFeatures = features.items.some((f) => f.title);
  const hasFaq = faq.items.some((f) => f.q);
  const materials = steps.materials.filter((m) => m.desc);

  return (
    <>
      {/* تنسيقات صفحات الخدمة — كانت مضمّنة في كل صفحة ثابتة على حدة */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/service.css" />

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

          <div className="svc-hero-img glass">
            <Image src={hero.image} alt={page.name} width={1536} height={683} priority />
          </div>
        </div>

        {/* ═══════════ خطوات العمل ═══════════ */}
        {hasSteps && (
          <div id="steps" className="svc-sec" style={{ paddingTop: 0 }}>
            <SectionHead tag={steps.tag} h2={steps.h2} body={steps.body} />

            {/* عدد الأعمدة يتبع عدد الخطوات — الصبغ خمس والباقي أربع */}
            <div
              className="steps-grid"
              style={{ '--steps': steps.items.length } as React.CSSProperties}
            >
              {steps.items.map((s) => (
                <div key={s.num} className="step-card glass">
                  <div className="step-num">{s.num}</div>
                  {s.icon && <div className="step-icon">{s.icon}</div>}
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>

            {materials.length > 0 && (
              <div className="materials-strip glass">
                {materials.map((m, i) => (
                  <div key={m.name} style={{ display: 'contents' }}>
                    {i > 0 && <div className="mat-divider" />}
                    <div className="mat-item">
                      <div className="mat-name">{m.name}</div>
                      <div className="mat-desc">{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ لماذا نحن ═══════════ */}
        {hasFeatures && (
          <div id="features" className="svc-sec" style={{ paddingTop: 0 }}>
            <SectionHead tag={features.tag} h2={features.h2} body={features.body} />
            <div className="features-grid">
              {features.items
                .filter((f) => f.title)
                .map((f) => (
                  <div key={f.num} className="feature-card glass">
                    <div className="feature-body">
                      <h3>{f.title}</h3>
                      <p>{f.body}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ═══════════ معرض الأعمال ═══════════ */}
        <div id="gallery" className="svc-sec" style={{ paddingTop: 0 }}>
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

        {/* ═══════════ الأسئلة الشائعة ═══════════ */}
        {hasFaq && (
          <div id="faq" className="svc-sec" style={{ paddingTop: 0 }}>
            <SectionHead tag={faq.tag} h2={faq.h2} />
            <div className="svc-faq">
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
        <div className="svc-cta glass">
          <Rich as="h2" html={cta.h2} />
          {cta.body && <p>{cta.body}</p>}
          <div className="svc-cta-btns">
            <a href="/contactus.html" className="btn btn-primary">
              {cta.book || t('svc.btn.book')}
            </a>
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="btn btn-glass"
              style={{ color: '#25D366', borderColor: 'rgba(37,211,102,.35)' }}
            >
              {t('svc.btn.wa2')}
            </a>
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
