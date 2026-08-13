import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWashPage } from '@/lib/site-data';
import { WashPageView } from '@/components/site/wash-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getWashPage('en');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | Haverkamp Kuwait` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/en/wash.html',
      languages: { 'ar-KW': '/wash.html', en: '/en/wash.html' },
    },
  };
}

export default async function WashPageEn() {
  const page = await getWashPage('en');
  if (!page) notFound();

  return (
    <>
      <LtrBoot />
      <WashPageView locale="en" />
    </>
  );
}
