'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { JOB_STATUS, toOptions } from '@/lib/labels';
import {
  addJobPackage,
  assignTechnician,
  createInvoiceFromJob,
  createJobOrder,
  deleteJobItem,
  issueWarranty,
  saveJobItem,
  setJobStatus,
  toggleJobItemDone,
  updateJobOrder,
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

const EMPTY_ITEM = {
  packageId: '',
  productId: '',
  serviceId: '',
  label: '',
  qty: '1',
  unitPrice: '',
};

export type ProtectionBrand = {
  serviceId: string;
  serviceName: string;
  packages: Array<{ id: string; name: string; price: number; features: string[] }>;
};

export function JobItemForm({
  jobOrderId,
  products,
  services,
  protections,
}: {
  jobOrderId: string;
  products: Array<{ id: string; nameAr: string; price: number }>;
  services: Array<{ id: string; name: string; price: number | null }>;
  protections: ProtectionBrand[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY_ITEM);

  /** مفتاح موحّد للقائمة الواحدة: `k:` باقة، `s:` خدمة، `p:` صنف */
  const picked = values.packageId
    ? `k:${values.packageId}`
    : values.serviceId
      ? `s:${values.serviceId}`
      : values.productId
        ? `p:${values.productId}`
        : '';

  const pickedPackage = values.packageId
    ? protections.flatMap((b) => b.packages).find((p) => p.id === values.packageId)
    : undefined;

  function pick(key: string) {
    const [kind, id] = key.split(':');

    if (kind === 'k') {
      const brand = protections.find((b) => b.packages.some((p) => p.id === id));
      const pkg = brand?.packages.find((p) => p.id === id);
      setValues((v) => ({
        ...v,
        packageId: id,
        serviceId: '',
        productId: '',
        qty: '1',
        label: brand && pkg ? `${brand.serviceName} — ${pkg.name}` : v.label,
        unitPrice: pkg ? String(pkg.price) : v.unitPrice,
      }));
    } else if (kind === 's') {
      const s = services.find((x) => x.id === id);
      setValues((v) => ({
        ...v,
        serviceId: id,
        packageId: '',
        productId: '',
        label: s?.name ?? v.label,
        unitPrice: s?.price != null ? String(s.price) : v.unitPrice,
      }));
    } else if (kind === 'p') {
      const p = products.find((x) => x.id === id);
      setValues((v) => ({
        ...v,
        productId: id,
        packageId: '',
        serviceId: '',
        label: p?.nameAr ?? v.label,
        unitPrice: p ? String(p.price) : v.unitPrice,
      }));
    } else {
      setValues((v) => ({ ...v, packageId: '', productId: '', serviceId: '' }));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = values.packageId
        ? await addJobPackage({
            jobOrderId,
            packageId: values.packageId,
            label: values.label,
            unitPrice: values.unitPrice,
          })
        : await saveJobItem({ jobOrderId, ...values });

      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setValues(EMPTY_ITEM);
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
            <Field label="اختر باقة حماية أو خدمة أو صنفاً" className="sm:col-span-2">
              <Select value={picked} onChange={(e) => pick(e.target.value)}>
                <option value="">— بند مخصّص —</option>
                {protections.map((brand) => (
                  <optgroup key={brand.serviceId} label={brand.serviceName}>
                    {brand.packages.map((p) => (
                      <option key={p.id} value={`k:${p.id}`}>
                        {p.name}
                        {p.price > 0 ? ` — من ${p.price} د.ك` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {services.length > 0 && (
                  <optgroup label="خدمات أخرى">
                    {services.map((s) => (
                      <option key={s.id} value={`s:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {products.length > 0 && (
                  <optgroup label="الأصناف">
                    {products.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {p.nameAr}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>

            {pickedPackage && pickedPackage.features.length > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-accent/30 bg-accent/10 p-3 sm:col-span-2">
                <p className="mb-1.5 text-[11px] font-semibold text-accent-soft">
                  تشمل الباقة — تُضاف كبنود متابعة يعلّم عليها الفني
                </p>
                <ul className="space-y-1 text-[12px] text-[var(--text-1)]">
                  {pickedPackage.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            <Field label="وصف البند" className="sm:col-span-2">
              <Input
                value={values.label}
                onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
                required
              />
            </Field>

            <Field label="الكمية" hint={pickedPackage ? 'الباقة وحدة واحدة' : undefined}>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={values.qty}
                onChange={(e) => setValues((v) => ({ ...v, qty: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                disabled={!!pickedPackage}
                required
              />
            </Field>

            <Field
              label="سعر الوحدة (د.ك)"
              hint={pickedPackage ? 'السعر يتغيّر حسب نوع السيارة — عدّله عند الحاجة' : undefined}
            >
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

export function EditJobOrderButton({
  job,
  vehicles,
}: {
  job: {
    id: string;
    vehicleId: string;
    odometer: string;
    promisedAt: string;
    intakeNotes: string;
    notes: string;
  };
  vehicles: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(job);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateJobOrder(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setValues(job);
          setOpen(true);
        }}
      >
        <Pencil />
        تعديل البيانات
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تعديل بيانات أمر الشغل"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="job-edit-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="job-edit-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="السيارة">
              <Select
                value={values.vehicleId}
                onChange={(e) => setValues((v) => ({ ...v, vehicleId: e.target.value }))}
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

            <Field label="ملاحظات الاستلام" className="sm:col-span-2">
              <Textarea
                value={values.intakeNotes}
                onChange={(e) => setValues((v) => ({ ...v, intakeNotes: e.target.value }))}
              />
            </Field>

            <Field label="ملاحظات داخلية" className="sm:col-span-2">
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
