import Link from 'next/link';
import { Trophy, Timer, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { getDictionary, getSettings, type Locale } from '@/lib/site-data';
import { getCompetitions } from '@/lib/competitions';
import { SiteNav } from '@/components/site/nav';
import { SiteFooter } from '@/components/site/footer';

export async function CompetitionsDirectoryView({ locale }: { locale: Locale }) {
  const [t, setting] = await Promise.all([getDictionary(locale), getSettings()]);
  const competitions = getCompetitions(locale);
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const headerTitle = isRtl ? 'مسابقات هافركامب' : 'Haverkamp Competitions';
  const headerSubtitle = isRtl
    ? 'اختر المسابقة المطلوبة للانتقال مباشرة إلى شاشة العرض التفاعلية داخل الفرع'
    : 'Choose a competition to jump directly to its branch display experience';
  const badgeLabel = isRtl ? 'شاشة الفرع التفاعلية' : 'Interactive Branch Display';
  const navLabel = isRtl
    ? 'المسابقات التفاعلية المعتمدة لعروض وفعاليات هافركامب الكويت 🇰🇼'
    : 'Approved interactive competitions for Haverkamp Kuwait events 🇰🇼';

  return (
    <div className="hk-comp-shell">
      <div className="bg-stage" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
      </div>

      <SiteNav
        t={t}
        locale={locale}
        contextLabel={navLabel}
        alternateHref={isRtl ? '/en/competitions' : '/competitions'}
      />

      <main className="hk-comp-page">
        <div className="hk-comp-container">
          <header className="hk-comp-header">
            <div className="hk-comp-badge">
              <Sparkles className="size-4 text-[var(--hk-comp-accent-blue)]" />
              <span>{badgeLabel}</span>
            </div>
            <h1 className="hk-comp-title">{headerTitle}</h1>
            <p className="hk-comp-subtitle">{headerSubtitle}</p>
          </header>

          <div className="hk-comp-grid">
            {competitions.map((comp) => {
              const IconComponent = comp.id === 'winner-draw' ? Trophy : Timer;

              return (
                <Link
                  key={comp.id}
                  href={comp.href}
                  className="hk-comp-card"
                  aria-label={`${comp.title} — ${comp.tagline}`}
                >
                  <div className="hk-comp-card-top">
                    <div className="hk-comp-card-icon">
                      <IconComponent className="size-7" />
                    </div>
                    <span className="hk-comp-card-tag">{comp.badge}</span>
                  </div>

                  <h2 className="hk-comp-card-title">{comp.title}</h2>
                  <p className="hk-comp-card-desc">{comp.description}</p>

                  {/* Interactive Card Visual Preview */}
                  <div className="hk-comp-card-preview" aria-hidden="true">
                    {comp.previewType === 'wheel' ? (
                      <div className="hk-comp-wheel">
                        <div className="hk-comp-wheel-disc animate-spin-slow" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                        <div className="font-mono text-3xl font-black tracking-wider text-[var(--hk-comp-accent-blue)]">
                          10.000<span className="text-sm font-sans ml-1 text-slate-400">s</span>
                        </div>
                        <span className="text-xs text-slate-400 font-semibold">
                          {isRtl ? 'الهدف: 10.000 ثانية' : 'Target: 10.000s'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="hk-comp-card-action">
                    <span className="text-sm font-bold text-[var(--hk-comp-text-secondary)]">
                      {comp.tagline}
                    </span>
                    <span className="hk-comp-card-action-btn">
                      <span>{isRtl ? 'بدء اللعبة' : 'Launch Game'}</span>
                      <ArrowIcon className="size-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <SiteFooter
          t={t}
          locale={locale}
          phone={setting('contact.phone', '+965 5111 1154')}
          whatsapp={setting('contact.whatsapp', '96551111154')}
          instagram={setting('social.instagram', 'https://instagram.com/haverkampkw')}
        />
      </main>
    </div>
  );
}
