import type { Metadata } from 'next';
import { getAccessoriesPage } from '@/lib/site-data';
import { AccessoriesPageView } from '@/components/site/accessories-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getAccessoriesPage('en');

  return {
    title: { absolute: 'Car Accessories | Haverkamp Kuwait' },
    description: page.hero.body,
    alternates: {
      canonical: '/en/accessories.html',
      languages: { 'ar-KW': '/accessories.html', en: '/en/accessories.html' },
    },
  };
}

export default function AccessoriesPageEn() {
  return (
    <>
      <LtrBoot />
      <AccessoriesPageView locale="en" />
    </>
  );
}
