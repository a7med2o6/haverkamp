import type { Metadata } from 'next';
import { WinnerDrawPublicView } from '@/components/competitions/winner-draw-public';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'برنامج سحب الفائزين | مسابقات هافركامب',
  description: 'شاشة سحب الفائزين والجوائز الفورية المباشرة داخل الفرع.',
  alternates: {
    canonical: '/competitions/winner-draw',
    languages: { 'ar-KW': '/competitions/winner-draw', en: '/en/competitions/winner-draw' },
  },
};

export default function WinnerDrawPublicPage() {
  return <WinnerDrawPublicView locale="ar" />;
}
