import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPpfPage } from '@/lib/site-data';
import { PpfPageView } from '@/components/site/ppf-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPpfPage('en');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | Haverkamp Kuwait` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: '/en/protication.html',
      languages: { 'ar-KW': '/protication.html', en: '/en/protication.html' },
    },
  };
}

export default async function PpfPageEn() {
  const page = await getPpfPage('en');
  if (!page) notFound();

  return (
    <>
      <LtrBoot />
      <PpfPageView locale="en" />
    </>
  );
}
