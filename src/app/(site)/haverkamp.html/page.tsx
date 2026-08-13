import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBrandPage } from '@/lib/site-data';
import { BrandPageView } from '@/components/site/brand-page';

const SLUG = 'haverkamp';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getBrandPage(SLUG, 'ar');
  if (!page) return {};

  return {
    title: { absolute: page.metaTitle ?? `${page.name} | هافركامب الكويت` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: `/${SLUG}.html`,
      languages: { 'ar-KW': `/${SLUG}.html`, en: `/en/${SLUG}.html` },
    },
  };
}

export default async function BrandPage() {
  const page = await getBrandPage(SLUG, 'ar');
  if (!page) notFound();

  return <BrandPageView slug={SLUG} locale="ar" />;
}
