'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Printer, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { PAYSLIP_ITEM_TYPE, toOptions } from '@/lib/labels';
import { addPayslipItem, deletePayslipItem } from '../../actions';

export function PrintPayslipButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer />
      طباعة
    </Button>
  );
}

export function AddItemButton({ payslipId }: { payslipId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ type: 'DEDUCTION', label: '', amount: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const presets =
    values.type === 'DEDUCTION'
      ? ['جزاء تأخير', 'خصم إداري', 'استقطاع مخالفة', 'سلفة نقدية']
      : ['مكافأة أداء', 'بدل عمل إضافي', 'حافز شهري', 'بدل مواصلات'];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await addPayslipItem({ payslipId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تمت الإضافة');
        setValues({ type: 'DEDUCTION', label: '', amount: '' });
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        إضافة بند
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="إضافة بند يدوي"
          description="مكافأة أو جزاء يُضاف لهذه القسيمة — يبقى محفوظاً عند إعادة توليد المسيّر"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="payslip-item-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إضافة
              </Button>
            </>
          }
        >
          <form id="payslip-item-form" onSubmit={onSubmit} className="space-y-4">
            <Field label="النوع">
              <Select
                value={values.type}
                onChange={(e) => setValues((v) => ({ ...v, type: e.target.value, label: '' }))}
              >
                {toOptions(PAYSLIP_ITEM_TYPE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الوصف" error={errors.label?.[0]}>
              <Input
                value={values.label}
                onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
                required
                autoFocus
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, label: p }))}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-accent hover:text-accent"
                >
                  {p}
                </button>
              ))}
            </div>

            <Field label="المبلغ (د.ك)" error={errors.amount?.[0]}>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.amount}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteItemButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label="حذف البند"
      onClick={() =>
        startTransition(async () => {
          const res = await deletePayslipItem({ id });
          if (res.ok) {
            toast.success(res.message ?? 'تم الحذف');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 className="text-danger" />}
    </Button>
  );
}
