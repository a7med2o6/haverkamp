import type { Metadata } from 'next';
import { getContactPage } from '@/lib/site-data';
import { ContactPageView } from '@/components/site/contact-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContactPage('ar');

  return {
    title: { absolute: `تواصل معنا — ${page.siteName}` },
    description: page.map.address,
    alternates: {
      canonical: '/contactus.html',
      languages: { 'ar-KW': '/contactus.html', en: '/en/contactus.html' },
    },
  };
}

export default function ContactPage() {
  return <ContactPageView locale="ar" />;
}
