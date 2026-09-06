import type { Metadata } from 'next';
import { WinnerDrawPublicView } from '@/components/competitions/winner-draw-public';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Winner Draw | Haverkamp Competitions',
  description: 'Live interactive lucky draw wheel for Haverkamp branch visitors.',
  alternates: {
    canonical: '/en/competitions/winner-draw',
    languages: { 'ar-KW': '/competitions/winner-draw', en: '/en/competitions/winner-draw' },
  },
};

export default function WinnerDrawPublicPageEn() {
  return (
    <>
      <LtrBoot />
      <WinnerDrawPublicView locale="en" />
    </>
  );
}
