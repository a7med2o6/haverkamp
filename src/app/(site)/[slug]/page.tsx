import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getServicePage, MIGRATED_SERVICES } from '@/lib/site-data';
import { ServicePageView } from '@/components/site/service-page';

export const dynamic = 'force-dynamic';

/**
 * نحافظ على امتداد .html في الروابط لأن صفحات الخدمات مفهرسة به على
 * haverkampkw.com — تغييره يهدر ترتيب البحث بلا مقابل.
 */
function toSlug(param: string) {
  return param.endsWith('.html') ? param.slice(0, -'.html'.length) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = toSlug(raw);
  if (!slug) return {};

  const page = await getServicePage(slug, 'ar');
  if (!page) return {};

  return {
    // absolute يتجاوز قالب العنوان في التخطيط الجذري — عناوين قاعدة
    // البيانات تتضمّن اسم المركز أصلاً فلا يتكرر مرتين
    title: { absolute: page.metaTitle ?? `${page.name} | هافركامب الكويت` },
    description: page.metaDescription ?? page.hero.body,
    alternates: {
      canonical: `/${slug}.html`,
      languages: { 'ar-KW': `/${slug}.html`, en: `/en/${slug}.html` },
    },
  };
}

export function generateStaticParams() {
  return Object.keys(MIGRATED_SERVICES).map((slug) => ({ slug: `${slug}.html` }));
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = toSlug(raw);
  if (!slug) notFound();

  const page = await getServicePage(slug, 'ar');
  if (!page) notFound();

  return <ServicePageView slug={slug} locale="ar" />;
}
