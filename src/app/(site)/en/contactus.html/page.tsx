import type { Metadata } from 'next';
import { getContactPage } from '@/lib/site-data';
import { ContactPageView } from '@/components/site/contact-page';
import { LtrBoot } from '@/components/site/ltr-boot';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContactPage('en');

  return {
    title: { absolute: `Contact Us — ${page.siteName}` },
    description: page.map.address,
    alternates: {
      canonical: '/en/contactus.html',
      languages: { 'ar-KW': '/contactus.html', en: '/en/contactus.html' },
    },
  };
}

export default function ContactPageEn() {
  return (
    <>
      <LtrBoot />
      <ContactPageView locale="en" />
    </>
  );
}
