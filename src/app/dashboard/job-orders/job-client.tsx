'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { JOB_STATUS, toOptions } from '@/lib/labels';
import { cn } from '@/lib/utils';
import {
  createInvoiceFromJob,
  deleteJobItem,
  issueWarranty,
  saveJobItem,
  setItemAssignees,
  setJobStatus,
  toggleJobItemDone,
  updateJobOrder,
} from './actions';

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
  productId: '',
  serviceId: '',
  label: '',
  qty: '1',
  unitPrice: '',
};

/**
 * إضافة بند مفرد بعد الاستلام — لتصحيح بيان التشغيل أو إضافة صنف نسيه.
 * الباقات لا تُضاف من هنا: بيان التشغيل هو من ينشئها بقطعها، وإضافتها
 * هنا كانت تنتج «أبناءً» بمعنى ثانٍ (محتويات باقة لا قطع سيارة) في نفس
 * الجدول، فيلتبس ما يُسنَد لفني بما هو مجرد وصف تسويقي.
 */
export function JobItemForm({
  jobOrderId,
  products,
  services,
}: {
  jobOrderId: string;
  products: Array<{ id: string; nameAr: string; price: number }>;
  services: Array<{ id: string; name: string; price: number | null }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY_ITEM);

  /** مفتاح موحّد للقائمة الواحدة: `s:` خدمة، `p:` صنف */
  const picked = values.serviceId
    ? `s:${values.serviceId}`
    : values.productId
      ? `p:${values.productId}`
      : '';

  function pick(key: string) {
    const [kind, id] = key.split(':');

    if (kind === 's') {
      const s = services.find((x) => x.id === id);
      setValues((v) => ({
        ...v,
        serviceId: id,
        productId: '',
        label: s?.name ?? v.label,
        unitPrice: s?.price != null ? String(s.price) : v.unitPrice,
      }));
    } else if (kind === 'p') {
      const p = products.find((x) => x.id === id);
      setValues((v) => ({
        ...v,
        productId: id,
        serviceId: '',
        label: p?.nameAr ?? v.label,
        unitPrice: p ? String(p.price) : v.unitPrice,
      }));
    } else {
      setValues((v) => ({ ...v, productId: '', serviceId: '' }));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveJobItem({ jobOrderId, ...values });

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
            <Field label="اختر خدمة أو صنفاً" className="sm:col-span-2">
              <Select value={picked} onChange={(e) => pick(e.target.value)}>
                <option value="">— بند مخصّص —</option>
                {services.length > 0 && (
                  <optgroup label="الخدمات">
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

            <Field
              label="سعر الوحدة (د.ك)"
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
  label,
  childCount,
  hideCheckbox = false,
}: {
  id: string;
  jobOrderId: string;
  isDone: boolean;
  label: string;
  /** عدد القطع تحت هذا البند — تُحذف معه */
  childCount: number;
  /** الخدمة ذات القطع تُنجَز بإنجاز قطعها لا بخانة مستقلة تكذّبها */
  hideCheckbox?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {!hideCheckbox && (
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
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="حذف البند"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="text-danger" />
        </Button>
      </div>

      {/*
        الحذف كان يقع بضغطة واحدة بلا رجعة — وبند الباقة الأب يجرّ معه
        محتوياته كلها في قاعدة البيانات. بقية اللوحة تسأل قبل الحذف،
        وهذا كان الاستثناء الوحيد.
      */}
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف البند"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteJobItem({ id, jobOrderId });
                    if (res.ok) {
                      toast.success(res.message ?? 'تم الحذف');
                      setConfirming(false);
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الحذف
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="text-sm text-[var(--text-1)]">
              <p>
                سيتم حذف <span className="font-semibold text-[var(--text-0)]">{label}</span>{' '}
                نهائياً.
              </p>
              {childCount > 0 && (
                <p className="mt-1.5 font-semibold text-danger">
                  وسيُحذف معه {childCount} من بنود الباقة التابعة له.
                </p>
              )}
              <p className="mt-1.5 text-[var(--text-2)]">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
          </div>
        </Modal>
      )}
    </>
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


/**
 * فنيّو القطعة.
 *
 * يظهر أسماء من اشتغلوا على هذه القطعة، والنقر يفتح اختيارهم. القطعة قد
 * يتقاسمها اثنان — الكبوت يركّبه فنيّان معاً — فالاختيار متعدّد لا مفرد.
 */
export function ItemAssignees({
  itemId,
  jobOrderId,
  employees,
  assigned,
  canWrite,
}: {
  itemId: string;
  jobOrderId: string;
  employees: Array<{ id: string; fullName: string }>;
  assigned: Array<{ id: string; fullName: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(assigned.map((a) => a.id));

  const names = assigned.map((a) => a.fullName).join('، ');

  if (!canWrite) {
    return (
      <span className="text-[11px] text-[var(--text-2)]">{names || '—'}</span>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setPicked(assigned.map((a) => a.id));
          setOpen(true);
        }}
        className={cn(
          'inline-flex max-w-[190px] items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] transition-colors',
          assigned.length > 0
            ? 'border-[var(--line)] text-[var(--text-1)] hover:border-accent hover:text-accent'
            : 'border-dashed border-[var(--line-strong)] text-[var(--text-2)] hover:border-accent hover:text-accent'
        )}
      >
        {assigned.length > 0 ? (
          <Users className="size-3.5 shrink-0" />
        ) : (
          <UserPlus className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{names || 'إسناد فني'}</span>
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="من اشتغل على هذه القطعة؟"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await setItemAssignees({
                      itemId,
                      jobOrderId,
                      employeeIds: picked,
                    });
                    if (res.ok) {
                      toast.success(res.message ?? 'تم');
                      setOpen(false);
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-[13px] text-[var(--text-2)]">لا يوجد موظفون نشطون</p>
            ) : (
              employees.map((e) => {
                const on = picked.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] transition-colors',
                      on
                        ? 'border-accent bg-accent/10 text-[var(--text-0)]'
                        : 'border-[var(--line)] text-[var(--text-1)] hover:border-[var(--line-strong)]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      className="size-4 accent-[var(--color-accent)]"
                      onChange={() =>
                        setPicked((p) =>
                          p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]
                        )
                      }
                    />
                    {e.fullName}
                  </label>
                );
              })
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
