import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can, type Permission } from '@/lib/rbac';

/** يضمن وجود جلسة — يعيد التوجيه لصفحة الدخول إن لم توجد */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

/** يضمن وجود صلاحية محددة — يعيد التوجيه للوحة إن لم تتوفر */
export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  if (!can(session.user.role, permission)) {
    redirect('/dashboard?denied=' + encodeURIComponent(permission));
  }
  return session;
}

/** نسخة للـ Server Actions / API — ترمي خطأ بدل التوجيه */
export async function assertPermission(permission: Permission) {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  if (!can(session.user.role, permission)) throw new Error('FORBIDDEN');
  return session;
}
