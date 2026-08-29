'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { deleteSupplier, saveSupplier } from './actions';

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
};

const EMPTY = { name: '', phone: '', email: '', country: '', address: '', notes: '' };

export function SupplierFormButton({ supplier }: { supplier?: Supplier }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function fill() {
    setValues(
      supplier
        ? {
            name: supplier.name,
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            country: supplier.country ?? '',
            address: supplier.address ?? '',
            notes: supplier.notes ?? '',
          }
        : EMPTY
    );
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveSupplier({ ...(supplier ? { id: supplier.id } : {}), ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
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
      {supplier ? (
        <Button variant="ghost" size="icon-sm" aria-label="تعديل المورّد" onClick={fill}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={fill}>
          <Plus />
          مورّد جديد
        </Button>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={supplier ? 'تعديل المورّد' : 'مورّد جديد'}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="supplier-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="supplier-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المورّد" className="sm:col-span-2" error={errors.name?.[0]}>
              <Input
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                required
                autoFocus
              />
            </Field>

            <Field label="الهاتف">
              <Input
                value={values.phone}
                onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="الدولة" hint="ألمانيا، كوريا، الصين…">
              <Input
                value={values.country}
                onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
              />
            </Field>

            <Field label="العنوان">
              <Input
                value={values.address}
                onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
              />
            </Field>

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteSupplierButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="حذف المورّد"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="text-danger" />
      </Button>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف المورّد"
          description={name}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                تراجع
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteSupplier({ id });
                    if (res.ok) {
                      toast.success(res.message ?? 'تم الحذف');
                      setConfirming(false);
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" />}
                حذف
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-[var(--text-1)]">
            لا يُحذف مورّد له أوامر شراء مسجّلة — احتفاظاً بتاريخ المشتريات.
          </p>
        </Modal>
      )}
    </>
  );
}
