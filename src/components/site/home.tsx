import Image from 'next/image';
import {
  getDictionary,
  getNavServices,
  getSettings,
  getTestimonials,
  type Locale,
} from '@/lib/site-data';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';

/* ── آراء العملاء الافتراضية: النصوص من الترجمات والأسماء والصور ثابتة ── */
const TESTIMONIAL_PEOPLE = [
  { key: 'testi.1', name: 'عمر السعدون', avatar: '/assets/male-1.png' },
  { key: 'testi.2', name: 'نورة العجمي', avatar: '/assets/female-3.png' },
  { key: 'testi.3', name: 'بدر الرشيدي', avatar: '/assets/male-2.png' },
  { key: 'testi.4', name: 'سارة المطيري', avatar: '/assets/female-3.png' },
  { key: 'testi.5', name: 'فهد العنزي', avatar: '/assets/male-1.png' },
  { key: 'testi.6', name: 'دلال الخالدي', avatar: '/assets/female-3.png' },
  { key: 'testi.7', name: 'خالد الدوسري', avatar: '/assets/male-2.png' },
  { key: 'testi.8', name: 'منيرة الصباح', avatar: '/assets/female-3.png' },
  { key: 'testi.9', name: 'يوسف الحربي', avatar: '/assets/male-1.png' },
];

const WHY_ITEMS = ['01', '02', '03', '04', '05', '06'];
const FAQ_ITEMS = ['1', '2', '3', '4', '5'];

function Stars({ size = 16 }: { size?: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </>
  );
}

/** نصوص الترجمة تحتوي وسوماً (<br/>, <b>) فنعرضها كـ HTML موثوق من قاعدتنا */
function Rich({
  html,
  as: Tag = 'span',
  ...props
}: { html: string; as?: 'span' | 'p' | 'h1' | 'h3' | 'div' } & React.HTMLAttributes<HTMLElement>) {
  return <Tag {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}

export async function SiteHome({ locale }: { locale: Locale }) {
  const [t, setting, services, testimonials] = await Promise.all([
    getDictionary(locale),
    getSettings(),
    getNavServices(locale),
    getTestimonials(locale),
  ]);

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');

  const reviews =
    testimonials ??
    TESTIMONIAL_PEOPLE.map((p) => ({
      body: t(p.key),
      author: p.name,
      carModel: t(`${p.key}.car`),
      avatar: p.avatar,
      rating: 5,
    }));

  return (
    <>
      {/* الخلفية المتحرّكة */}
      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} />

      <main className="shell">
        {/* ═══════════ HERO ═══════════ */}
        <section className="hero" style={{ padding: '60px 0 50px' }}>
          <div className="hero-top" style={{ margin: '0 0 44px' }}>
            <div className="hero-text">
              <Rich as="h1" html={t('hero.h1')} />

              <div className="hero-credentials">
                {['hero.cred1', 'hero.cred2'].map((key) => (
                  <div key={key} className="cred-row" style={{ maxWidth: 420, width: '100%' }}>
                    <span className="cred-mark">●</span>
                    <Rich html={t(key)} />
                  </div>
                ))}
              </div>

              <Rich as="p" className="hero-tagline" html={t('hero.tagline')} />
              <p className="lede">{t('hero.lede')}</p>
            </div>

            <div className="hero-logo-side">
              <Image
                src="/assets/haverkamp.png"
                alt="هافركامب"
                width={420}
                height={420}
                priority
                className="hero-logo-img"
              />
            </div>
          </div>

          <div className="hero-showcase">
            <div className="hero-stage">
              <div className="hero-grid-lines" aria-hidden="true" />
              <Image
                src="/assets/main.webp"
                alt={locale === 'en' ? 'Car protected with Haverkamp films' : 'سيارة محمية بأفلام هافركامب'}
                width={1200}
                height={700}
                priority
                className="hero-car-img"
              />

              <div className="float-badge fb-1 glass">
                <div className="fb-dot" />
                <div>
                  <div className="fb-label">CERTIFIED INSTALLER</div>
                  <div className="fb-value">{t('hero.badge.certified')}</div>
                </div>
              </div>

              <div className="float-badge fb-2 glass">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  style={{ color: 'var(--accent-warm)' }}
                >
                  <path d="M12 2L4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-5z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                  <div className="fb-label">WARRANTY</div>
                  <div className="fb-value">{t('hero.badge.warranty')}</div>
                </div>
              </div>

              <div className="float-badge fb-3 glass">
                <div className="fb-rating">
                  <span className="fb-rating-num">{locale === 'en' ? '4.9' : '٤٫٩'}</span>
                  <div className="fb-stars">
                    <Stars size={11} />
                  </div>
                </div>
                <div className="fb-label" style={{ marginTop: 4 }}>
                  {t('hero.badge.cars')}
                </div>
              </div>
            </div>
          </div>

          <div className="hero-strip glass">
            <div className="strip-item">
              <div className="num" data-count={setting('stats.years', 14)}>
                {String(setting('stats.years', 14))}
              </div>
              <div className="lbl">{t('hero.strip.years')}</div>
            </div>
            <div className="strip-item">
              <div className="num" data-count={setting('stats.clients', 5000)}>
                {String(setting('stats.clients', 5000))}
              </div>
              <div className="lbl">{t('hero.strip.clients')}</div>
            </div>
            <div className="strip-item">
              <div className="num" data-count={setting('stats.cars', 3200)}>
                {String(setting('stats.cars', 3200))}
              </div>
              <div className="lbl">{t('hero.strip.cars')}</div>
            </div>
          </div>
        </section>

        {/* ═══════════ الخدمات ═══════════ */}
        <section className="section" id="services" style={{ padding: '51px 0 90px' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {t('sec.services.tag')}
              </div>
              <h2>{t('sec.services.h2')}</h2>
            </div>
            <p className="desc">{t('sec.services.desc')}</p>
          </div>

          <div className="services-grid">
            {services.map((s) => (
              <a key={s.slug} href={`/${s.slug}.html`} className="service-card glass">
                {s.cardImage && (
                  <div className="img-slot">
                    <Image src={s.cardImage} alt={s.name} width={520} height={340} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <h3>{s.name}</h3>
                  <p>{s.shortDesc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ═══════════ لماذا نحن ═══════════ */}
        <section className="section" id="why" style={{ padding: '90px 0 45px' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {t('sec.why.tag')}
              </div>
              <h2>{t('sec.why.h2')}</h2>
            </div>
            <p className="desc">{t('sec.why.desc')}</p>
          </div>

          <div className="why-grid">
            {WHY_ITEMS.map((num) => (
              <div key={num} className="why-card glass">
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
                <div className="why-num">{num}</div>
                <h3>{t(`why.${num}.title`)}</h3>
                <p>{t(`why.${num}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ آراء العملاء ═══════════ */}
        <section className="section" id="testimonials" style={{ padding: '45px 0' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {t('sec.testi.tag')}
              </div>
              <h2>{t('sec.testi.h2')}</h2>
            </div>
            <p className="desc">{t('sec.testi.desc')}</p>
          </div>

          <div className="testi-grid">
            {reviews.map((r, i) => (
              <article key={i} className="testi-card glass">
                <div className="stars">
                  <Stars />
                </div>
                <blockquote>{r.body}</blockquote>
                <div className="who">
                  <div className="avatar">
                    {r.avatar && (
                      <Image src={r.avatar} alt={r.author} width={48} height={48} loading="lazy" />
                    )}
                  </div>
                  <div className="who-info">
                    <div className="name">{r.author}</div>
                    <div className="car">{r.carModel}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ═══════════ الأسئلة الشائعة ═══════════ */}
        <section className="section" id="faq" style={{ padding: '45px 0' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {t('sec.faq.tag')}
              </div>
              <h2>{t('sec.faq.h2')}</h2>
            </div>
            <p className="desc">{t('sec.faq.desc')}</p>
          </div>

          <div className="faq-list">
            {FAQ_ITEMS.map((n) => (
              <details key={n} className="faq-item glass">
                <summary>
                  <span>{t(`faq.${n}.q`)}</span>
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
                <div className="answer">{t(`faq.${n}.a`)}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ═══════════ تواصل معنا ═══════════ */}
        <section className="section" id="contact" style={{ padding: '45px 0' }}>
          <div className="section-head">
            <div>
              <div className="tag" style={{ color: 'rgb(10, 20, 36)' }}>
                {t('sec.contact.tag')}
              </div>
              <h2>{t('sec.contact.h2')}</h2>
            </div>
            <p className="desc">{t('sec.contact.desc')}</p>
          </div>

          <div className="contact-shell">
            <div className="contact-info glass" style={{ padding: '48px 40px 40px' }}>
              <h3>{t('contact.title')}</h3>
              <p>{t('contact.subtitle')}</p>

              <div className="contact-list">
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="ico">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <div className="lbl">{t('contact.phone.lbl')}</div>
                    <div className="val en">{phone}</div>
                  </div>
                </a>

                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener"
                  className="row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="ico">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
                    </svg>
                  </div>
                  <div>
                    <div className="lbl">{t('contact.wa.lbl')}</div>
                    <div className="val en">{phone}</div>
                  </div>
                </a>

                <div className="row">
                  <div className="ico">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <div className="lbl">{t('contact.location.lbl')}</div>
                    <div className="val">{t('contact.location.val')}</div>
                  </div>
                </div>

                <div className="row">
                  <div className="ico">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  </div>
                  <div>
                    <div className="lbl">{t('contact.hours.lbl')}</div>
                    <div className="val">{t('contact.hours.val')}</div>
                  </div>
                </div>
              </div>

              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener"
                className="nav-cta"
                style={{ marginTop: 28, display: 'inline-flex' }}
              >
                {t('contact.wa.btn')}
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
