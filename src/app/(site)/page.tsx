import type { Metadata } from 'next';
import { SiteHome } from '@/components/site/home';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'هافركامب — أفضل شركة حماية سيارات في الكويت',
  description:
    'هافركامب الكويت — الوكيل الحصري لحماية هافركامب الألمانية وكلايف ديزاين الكورية. حماية بدي، عازل حراري، صبغ، إصلاح جام، بوليش وغسيل.',
  alternates: {
    canonical: '/',
    languages: { 'ar-KW': '/', en: '/en' },
  },
};

export default function HomePage() {
  return <SiteHome locale="ar" />;
}
