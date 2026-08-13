import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTintPage } from '@/lib/site-data';
import { TintPageView } from '@/components/site/tint-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getTintPage('en');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | Haverkamp Kuwait` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/en/tint.html',
      languages: { 'ar-KW': '/tint.html', en: '/en/tint.html' },
    },
  };
}

export default async function TintPageEn() {
  const page = await getTintPage('en');
  if (!page) notFound();

  return (
    <>
      <LtrBoot />
      <TintPageView locale="en" />
    </>
  );
}
