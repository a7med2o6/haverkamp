import type { Metadata } from 'next';
import { getAccessoriesPage } from '@/lib/site-data';
import { AccessoriesPageView } from '@/components/site/accessories-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getAccessoriesPage('ar');

  return {
    title: { absolute: 'إكسسوارات السيارات | هافركامب الكويت' },
    description: page.hero.body,
    alternates: {
      canonical: '/accessories.html',
      languages: { 'ar-KW': '/accessories.html', en: '/en/accessories.html' },
    },
  };
}

export default function AccessoriesPage() {
  return <AccessoriesPageView locale="ar" />;
}
