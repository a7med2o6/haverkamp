'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Power } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ROLE_LABELS } from '@/lib/rbac';
import { saveUser, toggleUserActive } from './actions';

export interface UserValues {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  password?: string;
}

export function UserFormButton({ user }: { user?: UserValues }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!user?.id;

  const [values, setValues] = useState<UserValues>(
    user ?? { name: '', email: '', phone: '', role: 'RECEPTIONIST', isActive: true, password: '' }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof UserValues>(k: K, v: UserValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveUser(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={isEdit ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل المستخدم' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />مستخدم جديد</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل المستخدم' : 'مستخدم جديد'}
          description="الدور يحدّد الصفحات والصلاحيات المتاحة لهذا الحساب"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="user-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="user-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم" error={errors.name?.[0]}>
              <Input
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                required
                autoFocus
              />
            </Field>

            <Field label="البريد الإلكتروني" error={errors.email?.[0]}>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                dir="ltr"
                className="text-start"
                required
              />
            </Field>

            <Field label="رقم الهاتف">
              <Input
                value={values.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="الدور">
              <Select value={values.role} onChange={(e) => set('role', e.target.value)}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={isEdit ? 'كلمة مرور جديدة' : 'كلمة المرور'}
              className="sm:col-span-2"
              hint={isEdit ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية' : '8 أحرف على الأقل'}
              error={errors.password?.[0]}
            >
              <Input
                type="password"
                value={values.password ?? ''}
                onChange={(e) => set('password', e.target.value)}
                dir="ltr"
                className="text-start"
                autoComplete="new-password"
                required={!isEdit}
                minLength={8}
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)] sm:col-span-2">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              الحساب نشط (يستطيع تسجيل الدخول)
            </label>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ToggleUserButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
      title={isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleUserActive({ id, isActive: !isActive });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Power className={isActive ? 'text-ok' : 'text-[var(--text-2)]'} />
      )}
    </Button>
  );
}
