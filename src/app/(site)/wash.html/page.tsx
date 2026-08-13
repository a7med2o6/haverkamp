import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWashPage } from '@/lib/site-data';
import { WashPageView } from '@/components/site/wash-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getWashPage('ar');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | هافركامب الكويت` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/wash.html',
      languages: { 'ar-KW': '/wash.html', en: '/en/wash.html' },
    },
  };
}

export default async function WashPage() {
  const page = await getWashPage('ar');
  if (!page) notFound();

  return <WashPageView locale="ar" />;
}
