import type { Metadata } from 'next';
import { StopAt10GameView } from '@/components/competitions/stop-at-10-game';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stop at 10 Seconds | Haverkamp Competitions',
  description: 'Timing precision challenge to lock the clock at 10.000 seconds.',
  alternates: {
    canonical: '/en/competitions/stop-at-10',
    languages: { 'ar-KW': '/competitions/stop-at-10', en: '/en/competitions/stop-at-10' },
  },
};

export default function StopAt10PageEn() {
  return (
    <>
      <LtrBoot />
      <StopAt10GameView locale="en" />
    </>
  );
}
