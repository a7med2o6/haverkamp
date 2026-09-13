'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { deleteServicePackage, saveServicePackage, toggleServicePackageActive } from '../actions';

export interface PackageValues {
  id?: string;
  serviceId: string;
  nameAr: string;
  nameEn: string;
  price: string;
  priceFrom: boolean;
  duration: string;
  warranty: string;
  sortOrder: string;
  isActive: boolean;
  isPopular: boolean;
  features: string;
}

export function PackageFormButton({
  serviceId,
  serviceName,
  nameLocked = false,
  pkg,
}: {
  serviceId: string;
  serviceName: string;
  /** باقات الحماية: اسمها ثابت لأن بيان التشغيل يطابق عليه */
  nameLocked?: boolean;
  pkg?: PackageValues;
}) {
  const blank: PackageValues = {
    serviceId,
    nameAr: '',
    nameEn: '',
    price: '',
    priceFrom: false,
    duration: '',
    warranty: '',
    sortOrder: '0',
    isActive: true,
    isPopular: false,
    features: '',
  };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PackageValues>(pkg ?? blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(pkg?.id);

  function set<K extends keyof PackageValues>(key: K, value: PackageValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function openForm() {
    // يفتح على آخر ما حُفظ لا على ما كُتب ثم أُلغي
    setValues(pkg ?? blank);
    setErrors({});
    setOpen(true);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveServicePackage(values);
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
      {editing ? (
        <Button variant="ghost" size="icon-sm" onClick={openForm} aria-label={`تعديل ${pkg?.nameAr}`}>
          <Pencil />
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={openForm}>
          <Plus />
          إضافة باقة
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `تعديل ${pkg?.nameAr}` : 'باقة جديدة'}
        description={serviceName}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button type="submit" form="package-form" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              حفظ
            </Button>
          </>
        }
      >
        <form id="package-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="اسم الباقة"
            error={errors.nameAr?.[0]}
            hint={nameLocked && editing ? 'ثابت — بيان التشغيل يقترح السعر بمطابقة هذا الاسم' : undefined}
          >
            <Input
              value={values.nameAr}
              onChange={(event) => set('nameAr', event.target.value)}
              disabled={nameLocked && editing}
              required
            />
          </Field>
          <Field label="الاسم بالإنجليزية" error={errors.nameEn?.[0]} hint="اختياري">
            <Input dir="ltr" value={values.nameEn} onChange={(event) => set('nameEn', event.target.value)} />
          </Field>
          <Field label="السعر" error={errors.price?.[0]} hint="د.ك — 3 خانات عشرية">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              dir="ltr"
              value={values.price}
              onChange={(event) => set('price', event.target.value)}
              required
            />
          </Field>
          <Field label="الترتيب" error={errors.sortOrder?.[0]} hint="الأصغر يظهر أولاً">
            <Input
              type="number"
              dir="ltr"
              value={values.sortOrder}
              onChange={(event) => set('sortOrder', event.target.value)}
            />
          </Field>
          <Field label="المدة" error={errors.duration?.[0]} hint="اختياري — مثال: ٣ أيام">
            <Input value={values.duration} onChange={(event) => set('duration', event.target.value)} />
          </Field>
          <Field label="الكفالة" error={errors.warranty?.[0]} hint="اختياري — مثال: ١٠ سنوات">
            <Input value={values.warranty} onChange={(event) => set('warranty', event.target.value)} />
          </Field>
          <Field label="المميزات" error={errors.features?.[0]} hint="ميزة في كل سطر" className="sm:col-span-2">
            <Textarea
              rows={4}
              value={values.features}
              onChange={(event) => set('features', event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-x-6 gap-y-3 sm:col-span-2">
            {(
              [
                ['priceFrom', 'السعر «يبدأ من» — يتغيّر حسب السيارة'],
                ['isActive', 'مفعّلة — تُقترح في النظام'],
                ['isPopular', 'الأكثر طلباً'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-[var(--text-1)]">
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(event) => set(key, event.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {label}
              </label>
            ))}
          </div>
        </form>
      </Modal>
    </>
  );
}

export function TogglePackageButton({ id, isActive, name }: { id: string; isActive: boolean; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = isActive ? `إيقاف ${name}` : `تفعيل ${name}`;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleServicePackageActive({ id, isActive: !isActive });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : isActive ? <EyeOff /> : <Eye />}
    </Button>
  );
}

export function DeletePackageButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onDelete() {
    startTransition(async () => {
      const res = await deleteServicePackage({ id });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحذف');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setConfirming(true)} aria-label={`حذف ${name}`}>
        <Trash2 className="text-danger" />
      </Button>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف الباقة"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button variant="danger" onClick={onDelete} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الحذف
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 size-5 shrink-0 text-danger" />
            <p className="text-sm text-[var(--text-1)]">
              ستُحذف «{name}» نهائياً. للاحتفاظ بها خارج الاقتراحات أوقفها بدل حذفها.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
