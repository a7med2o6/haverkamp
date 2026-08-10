'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { JOB_STATUS, toOptions } from '@/lib/labels';
import {
  assignTechnician,
  createInvoiceFromJob,
  createJobOrder,
  deleteJobItem,
  issueWarranty,
  saveJobItem,
  setJobStatus,
  toggleJobItemDone,
} from './actions';

export function NewJobOrderButton({
  customers,
}: {
  customers: Array<{ id: string; name: string; phone: string; vehicles: Array<{ id: string; label: string }> }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    customerId: '',
    vehicleId: '',
    odometer: '',
    promisedAt: '',
    intakeNotes: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const vehicles = customers.find((c) => c.id === values.customerId)?.vehicles ?? [];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await createJobOrder(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الإنشاء');
        setOpen(false);
        router.push(`/dashboard/job-orders/${res.id}`);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        أمر شغل جديد
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="أمر شغل جديد"
          description="سجّل استلام السيارة وملاحظات حالتها"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="job-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إنشاء
              </Button>
            </>
          }
        >
          <form id="job-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="العميل" className="sm:col-span-2" error={errors.customerId?.[0]}>
              <Select
                value={values.customerId}
                onChange={(e) =>
                  setValues((v) => ({ ...v, customerId: e.target.value, vehicleId: '' }))
                }
                required
              >
                <option value="">— اختر العميل —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="السيارة">
              <Select
                value={values.vehicleId}
                onChange={(e) => setValues((v) => ({ ...v, vehicleId: e.target.value }))}
                disabled={!values.customerId}
              >
                <option value="">— بدون سيارة محدّدة —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="قراءة العداد (كم)">
              <Input
                type="number"
                min={0}
                value={values.odometer}
                onChange={(e) => setValues((v) => ({ ...v, odometer: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="موعد التسليم المتوقّع" className="sm:col-span-2">
              <Input
                type="datetime-local"
                value={values.promisedAt}
                onChange={(e) => setValues((v) => ({ ...v, promisedAt: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field
              label="ملاحظات الاستلام"
              className="sm:col-span-2"
              hint="خدوش موجودة، أضرار سابقة، أغراض داخل السيارة…"
            >
              <Textarea
                value={values.intakeNotes}
                onChange={(e) => setValues((v) => ({ ...v, intakeNotes: e.target.value }))}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function JobStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      aria-label="تغيير حالة أمر الشغل"
      className="h-9 w-40 text-[13px]"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const res = await setJobStatus({ id, status: next });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      {toOptions(JOB_STATUS).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function JobItemForm({
  jobOrderId,
  products,
}: {
  jobOrderId: string;
  products: Array<{ id: string; nameAr: string; price: number }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ productId: '', label: '', qty: '1', unitPrice: '' });

  function pickProduct(id: string) {
    const p = products.find((x) => x.id === id);
    setValues((v) => ({
      ...v,
      productId: id,
      label: p?.nameAr ?? v.label,
      unitPrice: p ? String(p.price) : v.unitPrice,
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveJobItem({ jobOrderId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setValues({ productId: '', label: '', qty: '1', unitPrice: '' });
        setOpen(false);
        router.refresh();
      } else {
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
          title="إضافة بند لأمر الشغل"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="job-item-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إضافة
              </Button>
            </>
          }
        >
          <form id="job-item-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="اختر من الأصناف" className="sm:col-span-2">
              <Select value={values.productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">— بند مخصّص —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="وصف البند" className="sm:col-span-2">
              <Input
                value={values.label}
                onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
                required
              />
            </Field>

            <Field label="الكمية">
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={values.qty}
                onChange={(e) => setValues((v) => ({ ...v, qty: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="سعر الوحدة (د.ك)">
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.unitPrice}
                onChange={(e) => setValues((v) => ({ ...v, unitPrice: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function JobItemActions({
  id,
  jobOrderId,
  isDone,
}: {
  id: string;
  jobOrderId: string;
  isDone: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <input
        type="checkbox"
        checked={isDone}
        disabled={pending}
        aria-label="تعليم البند كمنجز"
        className="size-4 accent-[var(--color-accent)]"
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            const res = await toggleJobItemDone({ id, jobOrderId, isDone: next });
            if (res.ok) router.refresh();
            else toast.error(res.error);
          });
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="حذف البند"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteJobItem({ id, jobOrderId });
            if (res.ok) {
              toast.success(res.message ?? 'تم الحذف');
              router.refresh();
            } else toast.error(res.error);
          })
        }
      >
        <Trash2 className="text-danger" />
      </Button>
    </div>
  );
}

export function AssigneePicker({
  jobOrderId,
  employees,
  assigned,
}: {
  jobOrderId: string;
  employees: Array<{ id: string; fullName: string }>;
  assigned: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(employeeId: string, remove: boolean) {
    startTransition(async () => {
      const res = await assignTechnician({ jobOrderId, employeeId, remove });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {employees.map((e) => {
        const isAssigned = assigned.includes(e.id);
        return (
          <button
            key={e.id}
            disabled={pending}
            onClick={() => toggle(e.id, isAssigned)}
            className={
              isAssigned
                ? 'rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-[12px] font-medium text-accent-soft'
                : 'rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
            }
          >
            {e.fullName}
          </button>
        );
      })}
    </div>
  );
}

export function CreateInvoiceButton({ jobOrderId }: { jobOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await createInvoiceFromJob({ jobOrderId });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.push(`/dashboard/invoices/${res.id}`);
          } else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <FileText />}
      إصدار فاتورة
    </Button>
  );
}

export function IssueWarrantyButton({
  jobOrderId,
  services,
}: {
  jobOrderId: string;
  services: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ serviceId: '', months: '12', terms: '' });

  function submit() {
    startTransition(async () => {
      const res = await issueWarranty({ jobOrderId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck />
        إصدار كفالة
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="إصدار شهادة كفالة"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إصدار
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="الخدمة">
              <Select
                value={values.serviceId}
                onChange={(e) => setValues((v) => ({ ...v, serviceId: e.target.value }))}
              >
                <option value="">— غير محدّدة —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="مدة الكفالة (شهر)">
              <Select
                value={values.months}
                onChange={(e) => setValues((v) => ({ ...v, months: e.target.value }))}
              >
                {[12, 24, 36, 60, 84, 120].map((m) => (
                  <option key={m} value={m}>
                    {m / 12} {m / 12 === 1 ? 'سنة' : m / 12 === 2 ? 'سنتان' : 'سنوات'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="بنود الكفالة">
              <Textarea
                value={values.terms}
                onChange={(e) => setValues((v) => ({ ...v, terms: e.target.value }))}
                placeholder="ما تغطيه الكفالة وما تستثنيه…"
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
