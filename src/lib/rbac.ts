import type { Role } from '@/generated/prisma/enums';

/** الوحدات المتاحة في لوحة التحكم */
export const MODULES = [
  'dashboard',
  'cms',
  'crm',
  'workshop',
  'pos',
  'inventory',
  'hr',
  'reports',
  'settings',
] as const;

export type ModuleKey = (typeof MODULES)[number];
export type Action = 'read' | 'write' | 'delete';
export type Permission = `${ModuleKey}:${Action}` | '*';

const ALL: Permission[] = ['*'];

function full(...mods: ModuleKey[]): Permission[] {
  return mods.flatMap((m) => [`${m}:read`, `${m}:write`, `${m}:delete`] as Permission[]);
}

function readWrite(...mods: ModuleKey[]): Permission[] {
  return mods.flatMap((m) => [`${m}:read`, `${m}:write`] as Permission[]);
}

function readOnly(...mods: ModuleKey[]): Permission[] {
  return mods.map((m) => `${m}:read` as Permission);
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER: [
    ...readOnly('dashboard'),
    ...full('crm', 'workshop', 'pos', 'inventory'),
    ...readWrite('cms'),
    ...readOnly('hr', 'reports'),
  ],
  HR: [...readOnly('dashboard'), ...full('hr'), ...readOnly('reports')],
  ACCOUNTANT: [
    ...readOnly('dashboard'),
    ...readWrite('pos', 'inventory'),
    ...readOnly('crm', 'workshop', 'hr', 'reports'),
  ],
  CASHIER: [...readOnly('dashboard'), ...readWrite('pos'), ...readOnly('crm', 'inventory')],
  TECHNICIAN: [...readOnly('dashboard', 'crm'), ...readWrite('workshop')],
  RECEPTIONIST: [...readOnly('dashboard'), ...readWrite('crm', 'workshop'), ...readOnly('pos')],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(permission);
}

/** هل يملك الدور أي صلاحية على الوحدة (لإظهارها في القائمة الجانبية) */
export function canAccessModule(role: Role | undefined | null, mod: ModuleKey): boolean {
  return can(role, `${mod}:read`) || can(role, `${mod}:write`);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'المالك',
  ADMIN: 'مدير النظام',
  MANAGER: 'مدير الفرع',
  HR: 'موارد بشرية',
  ACCOUNTANT: 'محاسب',
  CASHIER: 'كاشير',
  TECHNICIAN: 'فني',
  RECEPTIONIST: 'استقبال',
};
