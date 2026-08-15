import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServicePage } from '@/lib/site-data';
import { ServicePageView } from '@/components/site/service-page';
import { LtrBoot } from '@/components/site/ltr-boot';

const SLUG = 'glass';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getServicePage(SLUG, 'en');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | Haverkamp Kuwait` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: `/en/${SLUG}.html`,
      languages: { 'ar-KW': `/${SLUG}.html`, en: `/en/${SLUG}.html` },
    },
  };
}

export default async function ServicePageEn() {
  const page = await getServicePage(SLUG, 'en');
  if (!page) notFound();

  return (
    <>
      <LtrBoot />
      <ServicePageView slug={SLUG} locale="en" />
    </>
  );
}
