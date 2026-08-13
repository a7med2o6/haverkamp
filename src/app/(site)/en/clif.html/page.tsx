import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBrandPage } from '@/lib/site-data';
import { BrandPageView } from '@/components/site/brand-page';
import { LtrBoot } from '@/components/site/ltr-boot';

const SLUG = 'clif';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getBrandPage(SLUG, 'en');
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

export default async function BrandPageEn() {
  const page = await getBrandPage(SLUG, 'en');
  if (!page) notFound();

  return (
    <>
      <LtrBoot />
      <BrandPageView slug={SLUG} locale="en" />
    </>
  );
}
