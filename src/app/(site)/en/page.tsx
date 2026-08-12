import type { Metadata } from 'next';
import { SiteHome } from '@/components/site/home';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Haverkamp — Kuwait’s #1 Car Protection',
  description:
    'Haverkamp Kuwait — exclusive distributor of Haverkamp Germany and Clif Design Korea. Paint protection film, window tinting, paint, glass repair, polishing and wash.',
  alternates: {
    canonical: '/en',
    languages: { 'ar-KW': '/', en: '/en' },
  },
};

export default function HomePageEn() {
  return (
    <>
      <LtrBoot />
      <SiteHome locale="en" />
    </>
  );
}
