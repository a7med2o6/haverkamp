import type { Metadata } from 'next';
import { requirePermission } from '@/lib/guard';
import { can } from '@/lib/rbac';
import { WinnerDrawCmsManager } from '@/components/dashboard/winner-draw-cms-manager';

export const metadata: Metadata = {
  title: 'إدارة مسابقة السحب | لوحة تحكم هافركامب',
  description: 'إدارة إعدادات وأسماء وجوائز مسابقة السحب لشاشات العرض داخل الفرع.',
};

export default async function WinnerDrawCmsPage() {
  const session = await requirePermission('cms:read');
  const isWriteable = can(session.user.role, 'cms:write');

  return <WinnerDrawCmsManager isWriteable={isWriteable} />;
}
