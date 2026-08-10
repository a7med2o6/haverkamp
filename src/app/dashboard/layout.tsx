import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { requireAuth } from '@/lib/guard';
import { DashboardShell } from '@/components/dashboard/shell';

export const metadata: Metadata = {
  title: { default: 'لوحة التحكم', template: '%s | لوحة تحكم هافركامب' },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <SessionProvider session={session}>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
