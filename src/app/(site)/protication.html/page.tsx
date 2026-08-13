import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPpfPage } from '@/lib/site-data';
import { PpfPageView } from '@/components/site/ppf-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPpfPage('ar');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | هافركامب الكويت` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/protication.html',
      languages: { 'ar-KW': '/protication.html', en: '/en/protication.html' },
    },
  };
}

export default async function PpfPage() {
  const page = await getPpfPage('ar');
  if (!page) notFound();

  return <PpfPageView locale="ar" />;
}
