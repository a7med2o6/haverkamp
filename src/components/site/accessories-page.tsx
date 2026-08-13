import Image from 'next/image';
import {
  getAccessoriesPage,
  getDictionary,
  getSettings,
  type Locale,
} from '@/lib/site-data';
import { Rich } from './rich';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { ShopFilter } from './shop-filter';

function WaIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** متجر الإكسسوارات — المنتجات من جدول المنتجات نفسه المستعمل في نقطة البيع */
export async function AccessoriesPageView({ locale }: { locale: Locale }) {
  const [page, t, setting] = await Promise.all([
    getAccessoriesPage(locale),
    getDictionary(locale),
    getSettings(),
  ]);

  const phone = setting('contact.phone', '+965 5111 1154');
  const whatsapp = setting('contact.whatsapp', '96551111154');
  const instagram = setting('social.instagram', 'https://instagram.com/haverkampkw');
  const wa = `https://wa.me/${whatsapp}`;

  const askFor = (name: string) =>
    `${wa}?text=${encodeURIComponent(`أود الاستفسار عن ${name}`)}`;

  return (
    <>
      {/* تنسيقات هذه الصفحة — كانت مضمّنة في accessories.html */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/accessories.css" />

      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
      </div>

      <SiteNav t={t} locale={locale} links={page.nav} />

      <main className="shop-page">
        <div className="shop-hero">
          {page.hero.tag && <div className="tag">{page.hero.tag}</div>}
          <Rich as="h1" html={page.hero.h1} />
          {page.hero.body && <p>{page.hero.body}</p>}
        </div>

        <ShopFilter
          all={page.filterAll}
          sections={page.sections.map((s) => ({ id: s.id, nav: s.nav }))}
        />

        {page.sections.map((section) => (
          <div key={section.id} className="shop-section" id={section.id}>
            <div className="shop-section-head">
              <h2>{section.h2}</h2>
              <div className="s-rule" />
              <div className="s-count">
                {section.count} {page.countUnit}
              </div>
            </div>

            {section.card === 'prod' ? (
              <div className="products-grid">
                {section.items.map((p) => (
                  <div key={p.id} className="prod-card glass">
                    <div className="prod-img">
                      <Image src={p.image} alt={p.name} width={320} height={320} loading="lazy" />
                      <a
                        href={askFor(p.name)}
                        target="_blank"
                        rel="noopener"
                        className="prod-wa-btn"
                        aria-label={page.orderLabel}
                      >
                        <WaIcon />
                      </a>
                    </div>
                    <div className="prod-name">{p.name}</div>
                    {p.description && <div className="prod-desc">{p.description}</div>}
                    <div className="prod-price">
                      <span className="amount">{p.price}</span>
                      <span className="currency">{page.currency}</span>
                    </div>
                    <a
                      href={askFor(p.name)}
                      target="_blank"
                      rel="noopener"
                      className="prod-order-btn"
                    >
                      {page.orderLabel}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="medals-grid">
                {section.items.map((p) => (
                  <div key={p.id} className="medal-card glass">
                    <div className="medal-img">
                      <Image src={p.image} alt={p.name} width={320} height={320} loading="lazy" />
                    </div>
                    <div className="medal-footer">
                      <div className="medal-price">
                        <span className="amount">{p.price}</span>{' '}
                        <span className="currency">{page.currency}</span>
                      </div>
                      <a
                        href={askFor(p.name)}
                        target="_blank"
                        rel="noopener"
                        className="medal-wa"
                        aria-label={page.orderLabel}
                      >
                        <WaIcon />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ═══════════ دعوة للتواصل ═══════════ */}
        <div className="shop-cta glass">
          <h2>{page.cta.h2}</h2>
          <p>{page.cta.body}</p>
          <div className="shop-cta-btns">
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="btn btn-primary"
              style={{
                color: '#25D366',
                borderColor: 'rgba(37,211,102,.35)',
                background: 'rgba(37,211,102,.12)',
              }}
            >
              <WaIcon />
              <span>{t('svc.btn.wa2')}</span>
            </a>
            <a href="/contactus.html" className="btn btn-glass">
              {page.cta.contact}
            </a>
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
