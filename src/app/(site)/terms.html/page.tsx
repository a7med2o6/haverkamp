import type { Metadata } from 'next';
import { getDictionary } from '@/lib/site-data';
import { TermsPageView } from '@/components/site/terms-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary('ar');

  return {
    title: { absolute: `${t('terms.hero.h1')} — هافركامب الكويت` },
    description: t('terms.hero.p'),
    alternates: {
      canonical: '/terms.html',
      languages: { 'ar-KW': '/terms.html', en: '/en/terms.html' },
    },
  };
}

export default function TermsPage() {
  return <TermsPageView locale="ar" />;
}
