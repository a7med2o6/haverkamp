import type { Role } from '@/generated/prisma/enums';

/** الوحدات المتاحة في لوحة التحكم */
export const MODULES = [
  'dashboard',
  'cms',
  'crm',
  'workshop',
  'wash',
  'pos',
  'inventory',
  'hr',
  'reports',
  'settings',
] as const;

export type ModuleKey = (typeof MODULES)[number];
/**
 * visit: تسجيل نتيجة غسلة ميدانية إنجازاً أو تعذّراً.
 * افترقت عن write لأن غسّيل الميدان يسجّل مروره بيده، ولا يُفتح بمفتاحه
 * عقودُ الاشتراك ولا أسعارُها ولا فواتيرُ العملاء.
 */
export type Action = 'read' | 'write' | 'delete' | 'visit';
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
    ...full('crm', 'workshop', 'wash', 'pos', 'inventory'),
    'wash:visit',
    ...readWrite('cms'),
    ...readOnly('hr', 'reports'),
  ],
  HR: [...readOnly('dashboard'), ...full('hr'), ...readOnly('reports')],
  ACCOUNTANT: [
    ...readOnly('dashboard'),
    ...readWrite('pos', 'inventory'),
    ...readOnly('crm', 'workshop', 'wash', 'hr', 'reports'),
  ],
  CASHIER: [...readOnly('dashboard'), ...readWrite('pos'), ...readOnly('crm', 'inventory')],
  TECHNICIAN: [...readOnly('dashboard', 'crm'), ...readWrite('workshop')],
  RECEPTIONIST: [
    ...readOnly('dashboard'),
    ...readWrite('crm', 'workshop', 'wash'),
    'wash:visit',
    ...readOnly('pos'),
  ],
  /*
    الغسّيل لا يحتاج لوحة الإشراف ولا قراءة عقود الغسيل؛ صلاحيته تقتصر
    على تسجيل غسلات جولته اليومية المسندة إليه فقط.
  */
  WASHER: ['wash:visit'],
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
  WASHER: 'غسيل',
};
