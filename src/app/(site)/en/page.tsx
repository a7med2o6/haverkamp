import type { Metadata } from 'next';
import { SiteHome } from '@/components/site/home';

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
      {/*
        الجذر <html> يُضبط في التخطيط الأعلى على العربية RTL لأنها لغة اللوحة
        وأغلب الموقع. نقلبه هنا قبل الرسم لأن نظام التصميم يعتمد على
        html[dir="ltr"]. يُستغنى عن هذا عند نقل كل الصفحات إلى مسارات باللغة.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.setAttribute('dir','ltr');document.documentElement.setAttribute('lang','en');",
        }}
      />
      <SiteHome locale="en" />
    </>
  );
}
