import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTintPage } from '@/lib/site-data';
import { TintPageView } from '@/components/site/tint-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getTintPage('ar');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | هافركامب الكويت` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/tint.html',
      languages: { 'ar-KW': '/tint.html', en: '/en/tint.html' },
    },
  };
}

export default async function TintPage() {
  const page = await getTintPage('ar');
  if (!page) notFound();

  return <TintPageView locale="ar" />;
}
