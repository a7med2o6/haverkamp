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
  GLASS_PARTS,
  SERVICES,
  TINT_GRADES,
  serviceDef,
  optionParts,
} from '@/lib/intake';
import {
  createInvoiceFromJob,
  deleteJobItem,
  issueWarranty,
  addJobLine,
  setItemAssignees,
  setJobStatus,
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
  serviceKey: '',
  options: [] as string[],
  brand: '',
  brandName: '',
  price: '',
  grades: {} as Record<string, string>,
};

/**
 * إضافة خدمة إلى أمر شغل قائم — لتصحيح بيان التشغيل أو خدمة نُسيت.
 *
 * الخيارات هنا هي خيارات بيان التشغيل نفسها: الباقة والماركة ودرجات
 * العزل. لولا ذلك لأنتجت الشاشتان بندين مختلفي الشكل لنفس الخدمة —
 * أحدهما «حماية البدي — بدي كامل» بقطعه، والآخر «حماية البدي» عارياً.
 */
export function JobItemForm({
  jobOrderId,
  brands,
}: {
  jobOrderId: string;
  brands: Array<{ id: string; name: string; packages: Array<{ name: string; price: number }> }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY_ITEM);

  const service = serviceDef(values.serviceKey);
  const brand = brands.find((b) => b.id === values.brand);

  function reset() {
    setValues(EMPTY_ITEM);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parts = service?.glassParts
      ? GLASS_PARTS.filter((p) => values.grades[p.key]).map((p) => ({
          label: p.label,
          spec: values.grades[p.key],
          employeeIds: [],
        }))
      : service?.bodyParts
        ? optionParts(service, values.options).map((p) => ({
            label: p.label,
            spec: p.spec,
            employeeIds: [],
          }))
        : [];

    startTransition(async () => {
      const res = await addJobLine({
        jobOrderId,
        line: {
          key: values.serviceKey,
          options: values.options,
          brand: values.brand || null,
          brandName: values.brandName || null,
          price: values.price || 0,
          parts,
        },
      });

      if (res.ok) {
        toast.success(res.message ?? 'تم');
        reset();
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
          title="إضافة خدمة لأمر الشغل"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                type="submit"
                form="job-item-form"
                disabled={pending || !values.serviceKey}
              >
                {pending && <Loader2 className="animate-spin" />}
                إضافة
              </Button>
            </>
          }
        >
          <form id="job-item-form" onSubmit={onSubmit} className="space-y-4">
            <Field label="الخدمة">
              <Select
                value={values.serviceKey}
                onChange={(e) =>
                  // تغيير الخدمة يُسقط خياراتها: كلٌّ منها يخصّ خدمته
                  setValues({ ...EMPTY_ITEM, serviceKey: e.target.value })
                }
              >
                <option value="">— اختر الخدمة —</option>
                {SERVICES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            {service?.options && (
              <Field label={service.multi ? 'الاختيارات' : 'الباقة'}>
                <div className="flex flex-wrap gap-1.5">
                  {service.options.map((o) => {
                    const on = values.options.includes(o.key);
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => {
                          const next = service.multi
                            ? on
                              ? values.options.filter((x) => x !== o.key)
                              : [...values.options, o.key]
                            : [o.key];
                          const pkg = brand?.packages.find((p) => p.name === o.packageName);
                          setValues((v) => ({
                            ...v,
                            options: next,
                            price: pkg?.price ? String(pkg.price) : v.price,
                          }));
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                          on
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-[var(--line)] text-[var(--text-1)] hover:border-accent'
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {service?.needsBrand && (
              <Field label="الماركة">
                <Select
                  value={values.brand}
                  onChange={(e) => {
                    const b = brands.find((x) => x.id === e.target.value);
                    const opt = service.options?.find((o) => o.key === values.options[0]);
                    const pkg = b?.packages.find((p) => p.name === opt?.packageName);
                    setValues((v) => ({
                      ...v,
                      brand: e.target.value,
                      price: pkg?.price ? String(pkg.price) : v.price,
                    }));
                  }}
                >
                  <option value="">— اختر الماركة —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {/* ماركة تُذكر بالاسم — أفلام العزل وحماية الجام */}
            {service?.brandOptions && (
              <Field label={service.brandLabel ?? 'الماركة'}>
                <Select
                  value={values.brandName}
                  onChange={(e) => setValues((v) => ({ ...v, brandName: e.target.value }))}
                >
                  <option value="">— اختر —</option>
                  {service.brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {service?.glassParts && (
              <Field label="درجة العزل لكل قطعة">
                <div className="space-y-1.5">
                  {GLASS_PARTS.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-2.5 py-1.5"
                    >
                      <span className="text-[12px] text-[var(--text-1)]">{p.label}</span>
                      <Select
                        value={values.grades[p.key] ?? ''}
                        className="h-8 w-28 text-[12px]"
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            grades: { ...v.grades, [p.key]: e.target.value },
                          }))
                        }
                      >
                        <option value="">بدون</option>
                        {TINT_GRADES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </Field>
            )}

            {service?.bodyParts && optionParts(service, values.options).length > 0 && (
              <p className="text-[11px] text-[var(--text-2)]">
                {optionParts(service, values.options).length} قطعة تُنشأ مع البند
              </p>
            )}

            <Field label="السعر (د.ك)" hint="اتركه صفراً إن كان ضمن الباقة">
              <Input
                type="number"
                min="0"
                step="0.001"
                className="max-w-40"
                value={values.price}
                onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
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

/**
 * حذف بند من أمر الشغل.
 *
 * لم يعد معه تعليم «منجز»: الخدمة ذات القطع تنتهي بانتهاء قطعها لا
 * بعلامة مستقلّة قد تكذّبها، فبقيت الخانة على بعض البنود دون بعض —
 * وعلامةٌ نصفُ موجودة أسوأ من غيابها.
 */
export function JobItemActions({
  id,
  jobOrderId,
  label,
  childCount,
}: {
  id: string;
  jobOrderId: string;
  label: string;
  /** عدد القطع تحت هذا البند — تُحذف معه */
  childCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
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
        الحذف كان يقع بضغطة واحدة بلا رجعة — والخدمة تجرّ معها قطعها كلها
        في قاعدة البيانات. بقية اللوحة تسأل قبل الحذف.
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
                  وسيُحذف معه {childCount} من قطعه.
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
