import type { Metadata } from 'next';
import { StopAt10GameView } from '@/components/competitions/stop-at-10-game';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'تحدي 10 ثوانٍ | مسابقات هافركامب',
  description: 'تحدي دقة التوقيت والتوقف عند 10 ثوانٍ بالضبط على شاشة الفرع.',
  alternates: {
    canonical: '/competitions/stop-at-10',
    languages: { 'ar-KW': '/competitions/stop-at-10', en: '/en/competitions/stop-at-10' },
  },
};

export default function StopAt10Page() {
  return <StopAt10GameView locale="ar" />;
}
