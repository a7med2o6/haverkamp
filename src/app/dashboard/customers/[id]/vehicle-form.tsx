'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Car, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { deleteVehicle, saveVehicle } from '../actions';

export interface VehicleValues {
  id?: string;
  customerId: string;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  plateNo?: string | null;
  notes?: string | null;
}

export function VehicleFormButton({
  customerId,
  vehicle,
  canDelete = false,
  triggerVariant,
  afterDeleteHref,
}: {
  customerId: string;
  vehicle?: VehicleValues;
  /** الحذف داخل نافذة التعديل — لا زرّ أحمر دائم بجانب كل سيارة يُضغط سهواً */
  canDelete?: boolean;
  triggerVariant?: 'ghost' | 'secondary';
  /** من صفحة السيارة نفسها: بعد حذفها لا صفحة يُعاد تحميلها، فيُنتقل إلى هنا */
  afterDeleteHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!vehicle?.id;

  return (
    <>
      <Button
        variant={triggerVariant ?? (isEdit ? 'ghost' : 'secondary')}
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل السيارة' : 'إضافة سيارة'}
      >
        {isEdit ? <Pencil /> : <Plus />}
        {isEdit ? 'تعديل' : 'إضافة سيارة'}
      </Button>
      {open && (
        <VehicleModal
          initial={
            vehicle ?? {
              customerId,
              make: '',
              model: '',
              year: null,
              color: '',
              plateNo: '',
              notes: '',
            }
          }
          canDelete={isEdit && canDelete}
          afterDeleteHref={afterDeleteHref}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function VehicleModal({
  initial,
  canDelete,
  afterDeleteHref,
  onClose,
}: {
  initial: VehicleValues;
  canDelete: boolean;
  afterDeleteHref?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  /*
    التأكيد يحلّ محلّ النموذج في النافذة نفسها لا فوقها: نافذتان متراكبتان
    تُغلق إحداهما بـ Escape فتبقى الأخرى معلّقة بلا سياق.
  */
  const [confirming, setConfirming] = useState(false);

  function set<K extends keyof VehicleValues>(k: K, v: VehicleValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveVehicle(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        onClose();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    if (!initial.id) return;
    const id = initial.id;
    startTransition(async () => {
      const res = await deleteVehicle({ id, customerId: initial.customerId });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحذف');
        onClose();
        if (afterDeleteHref) router.push(afterDeleteHref);
        else router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (confirming) {
    return (
      <Modal
        open
        onClose={onClose}
        title="حذف السيارة"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              رجوع
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <Car className="mt-0.5 size-5 shrink-0 text-danger" />
          <p className="text-sm text-[var(--text-1)]">
            سيتم حذف {initial.make} {initial.model} نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'تعديل بيانات السيارة' : 'إضافة سيارة'}
      size="lg"
      footer={
        <>
          {canDelete && (
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="me-auto text-danger hover:text-danger"
            >
              <Trash2 />
              حذف السيارة
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button type="submit" form="vehicle-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="الماركة" error={errors.make?.[0]}>
          <Input
            value={values.make}
            onChange={(e) => set('make', e.target.value)}
            placeholder="مرسيدس، لكزس، لاند روفر…"
            required
            autoFocus
          />
        </Field>
        <Field label="الموديل" error={errors.model?.[0]}>
          <Input
            value={values.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="G63، LX600…"
            required
          />
        </Field>
        <Field label="سنة الصنع" error={errors.year?.[0]}>
          <Input
            type="number"
            value={values.year ?? ''}
            onChange={(e) => set('year', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="2024"
            dir="ltr"
            className="text-start tnum"
            min={1950}
            max={new Date().getFullYear() + 2}
          />
        </Field>
        <Field label="اللون" error={errors.color?.[0]}>
          <Input value={values.color ?? ''} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field label="رقم اللوحة" error={errors.plateNo?.[0]}>
          <Input
            value={values.plateNo ?? ''}
            onChange={(e) => set('plateNo', e.target.value)}
            dir="ltr"
            className="text-start tnum"
          />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="خدوش سابقة، تعديلات، ملاحظات الاستلام…"
          />
        </Field>
      </form>
    </Modal>
  );
}
