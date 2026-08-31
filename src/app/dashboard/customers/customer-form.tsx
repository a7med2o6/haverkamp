'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { CUSTOMER_SOURCE, toOptions } from '@/lib/labels';
import { saveCustomer } from './actions';

export interface CustomerFormValues {
  id?: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  civilId?: string | null;
  address?: string | null;
  area?: string | null;
  notes?: string | null;
  source: string;
}

const EMPTY: CustomerFormValues = {
  name: '',
  phone: '',
  altPhone: '',
  email: '',
  civilId: '',
  address: '',
  area: '',
  notes: '',
  source: 'WALK_IN',
};

export function CustomerFormButton({
  customer,
  variant = 'primary',
  label,
}: {
  customer?: CustomerFormValues;
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!customer?.id;

  return (
    <>
      <Button variant={variant} size={isEdit ? 'sm' : 'md'} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil /> : <Plus />}
        {label ?? (isEdit ? 'تعديل' : 'عميل جديد')}
      </Button>
      {open && (
        <CustomerFormModal
          initial={customer ?? EMPTY}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CustomerFormModal({
  initial,
  onClose,
}: {
  initial: CustomerFormValues;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<CustomerFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const res = await saveCustomer(values);
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

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'تعديل بيانات العميل' : 'عميل جديد'}
      description="الاسم ورقم الهاتف مطلوبان — باقي الحقول اختيارية"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button type="submit" form="customer-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم" error={errors.name?.[0]}>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="اسم العميل الكامل"
            required
            autoFocus
          />
        </Field>

        <Field label="رقم الهاتف" error={errors.phone?.[0]}>
          <Input
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+965 5111 1154"
            dir="ltr"
            className="text-start"
            required
          />
        </Field>

        <Field label="رقم بديل" error={errors.altPhone?.[0]}>
          <Input
            value={values.altPhone ?? ''}
            onChange={(e) => set('altPhone', e.target.value)}
            dir="ltr"
            className="text-start"
          />
        </Field>

        {/*
          `type=email` يرفض الإرسال عند أي نصّ ليس بريداً — برسالة
          إنجليزية من المتصفّح تُقرأ كأن الحقل إجباري، وكثيراً ما يملأ
          المتصفّح الحقل تلقائياً بما ليس بريداً. والحقل اختياري أصلاً،
          والتحقّق من صيغته يجري في الخادم برسالة عربية.
        */}
        <Field label="البريد الإلكتروني" error={errors.email?.[0]} hint="اختياري">
          <Input
            type="text"
            inputMode="email"
            value={values.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            dir="ltr"
            className="text-start"
          />
        </Field>

        <Field label="الرقم المدني" error={errors.civilId?.[0]}>
          <Input
            value={values.civilId ?? ''}
            onChange={(e) => set('civilId', e.target.value)}
            dir="ltr"
            className="text-start tnum"
          />
        </Field>

        <Field label="المنطقة" error={errors.area?.[0]}>
          <Input
            value={values.area ?? ''}
            onChange={(e) => set('area', e.target.value)}
            placeholder="الري، السالمية…"
          />
        </Field>

        <Field label="مصدر العميل" error={errors.source?.[0]}>
          <Select value={values.source} onChange={(e) => set('source', e.target.value)}>
            {toOptions(CUSTOMER_SOURCE).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="العنوان" error={errors.address?.[0]}>
          <Input value={values.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>

        <Field label="ملاحظات" className="sm:col-span-2" error={errors.notes?.[0]}>
          <Textarea
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="تفضيلات العميل، ملاحظات خاصة…"
          />
        </Field>
      </form>
    </Modal>
  );
}
