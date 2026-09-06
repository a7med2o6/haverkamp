import type { Metadata } from 'next';
import { CompetitionsDirectoryView } from '@/components/competitions/competitions-directory';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'المسابقات | هافركامب الكويت',
  description: 'مسابقات وشاشات التفاعل المباشر داخل فرع هافركامب الكويت.',
  alternates: {
    canonical: '/competitions',
    languages: { 'ar-KW': '/competitions', en: '/en/competitions' },
  },
};

export default function CompetitionsPage() {
  return <CompetitionsDirectoryView locale="ar" />;
}
