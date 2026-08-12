import type { Metadata } from 'next';
import { getDictionary } from '@/lib/site-data';
import { TermsPageView } from '@/components/site/terms-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary('en');

  return {
    title: { absolute: `${t('terms.hero.h1')} — Haverkamp Kuwait` },
    description: t('terms.hero.p'),
    alternates: {
      canonical: '/en/terms.html',
      languages: { 'ar-KW': '/terms.html', en: '/en/terms.html' },
    },
  };
}

export default function TermsPageEn() {
  return (
    <>
      <LtrBoot />
      <TermsPageView locale="en" />
    </>
  );
}
