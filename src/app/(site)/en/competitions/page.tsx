import type { Metadata } from 'next';
import { CompetitionsDirectoryView } from '@/components/competitions/competitions-directory';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Competitions | Haverkamp Kuwait',
  description: 'Interactive branch competitions and display challenges at Haverkamp Kuwait.',
  alternates: {
    canonical: '/en/competitions',
    languages: { 'ar-KW': '/competitions', en: '/en/competitions' },
  },
};

export default function CompetitionsPageEn() {
  return (
    <>
      <LtrBoot />
      <CompetitionsDirectoryView locale="en" />
    </>
  );
}
