'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  FileText,
  Loader2,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { JOB_STATUS, PAYMENT_METHOD, toOptions } from '@/lib/labels';
import { cn, formatKWD } from '@/lib/utils';
import {
  BODY_PARTS,
  GLASS_PARTS,
  PAINT_FINISHES,
  PAINT_PARTS,
  PRICE_APPROVAL_METHODS,
  SERVICES,
  TINT_GRADES,
  WARRANTY_SUBJECTS,
  optionParts,
  serviceDef,
  warrantyHasParts,
  warrantyPartLabels,
  warrantySubject,
  type PaintFinish,
  type PriceApprovalMethod,
} from '@/lib/intake';
import {
  createInvoiceFromJob,
  deleteJobItem,
  issueWarranty,
  addJobLine,
  setItemAssignees,
  setItemPrice,
  setJobStatus,
  updateJobOrder,
  updatePaintDetail,
} from './actions';
import { BLANK_PAINT, ChoiceChips, PaintFields, paintBlocker, paintPayload } from './paint-fields';

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
            // المنع يردّ القائمة إلى حالتها الحقيقية، وإلا أظهرت ما لم يقع
            router.refresh();
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
  paint: BLANK_PAINT,
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
  vehiclePaintCode = null,
}: {
  jobOrderId: string;
  brands: Array<{ id: string; name: string; packages: Array<{ name: string; price: number }> }>;
  /** كود لون سيارة الأمر — يُعبّأ في بند الصبغ */
  vehiclePaintCode?: string | null;
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
            key: p.key,
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
          unpriced: Boolean(service?.paint) && !values.price,
          parts,
          paint: service?.paint ? paintPayload(values.paint) : null,
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
                disabled={
                  pending || !values.serviceKey || Boolean(service?.paint && paintBlocker(values.paint))
                }
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
                  setValues({
                    ...EMPTY_ITEM,
                    serviceKey: e.target.value,
                    paint: {
                      ...BLANK_PAINT,
                      paintCode: serviceDef(e.target.value)?.paint ? (vehiclePaintCode ?? '') : '',
                    },
                  })
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

            {service?.paint && (
              <PaintFields
                value={values.paint}
                onChange={(paint) => setValues((v) => ({ ...v, paint }))}
                vehiclePaintCode={vehiclePaintCode}
              />
            )}

            <Field
              label="السعر (د.ك)"
              hint={
                service?.paint
                  ? 'اتركه فارغاً إن لم يُعاين بعد — يُسعَّر لاحقاً'
                  : 'اتركه صفراً إن كان ضمن الباقة'
              }
            >
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

/** طرق الدفع عند الإصدار — الآجل ليس دفعة: الفاتورة بلا دفعة آجلةٌ أصلاً */
const ISSUE_METHODS = toOptions(PAYMENT_METHOD).filter((o) => o.value !== 'CREDIT');

const fils = (n: number) => Math.round(n * 1000) / 1000;

/**
 * إصدار الفاتورة — شاشة لا زرّ.
 *
 * كان الزرّ يولّد فاتورة معلّقة بنقرة، ثم يُفتح الخصم في نافذة والتحصيل
 * في أخرى والعميل واقف. هنا يُرى ما سيُطالَب به بنداً بنداً، ويُسجَّل
 * الخصم والعربون أو المبلغ كلّه، ثم تصدر الفاتورة مرة واحدة.
 */
export function IssueInvoiceButton({
  jobOrderId,
  jobNumber,
  lines,
  unpriced,
}: {
  jobOrderId: string;
  jobNumber: string;
  /** البنود المسعَّرة كما ستظهر في الفاتورة */
  lines: { id: string; label: string; total: number }[];
  /** بنود بانتظار التسعير — تمنع الإصدار */
  unpriced: string[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [discount, setDiscount] = useState('');
  const [discountNote, setDiscountNote] = useState('');
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const subtotal = fils(lines.reduce((sum, l) => sum + l.total, 0));
  const discountValue = fils(Number(discount) || 0);
  const total = fils(subtotal - discountValue);
  const paying = fils(Number(amount) || 0);
  const left = fils(total - paying);

  const blocked = unpriced.length > 0;
  const tooMuchDiscount = discountValue > subtotal;
  const tooMuchPaid = paying > total;
  const canIssue = !blocked && !tooMuchDiscount && !tooMuchPaid && !pending;

  function reset() {
    setDiscount('');
    setDiscountNote('');
    setMethod('CASH');
    setAmount('');
    setReference('');
  }

  function submit() {
    startTransition(async () => {
      const res = await createInvoiceFromJob({
        jobOrderId,
        discountAmount: discountValue,
        discountNote,
        payment: paying > 0 ? { method, amount: paying, reference } : null,
      });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.push(`/dashboard/invoices/${res.id}`);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <FileText />
        إصدار فاتورة
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="إصدار فاتورة"
          description={`أمر الشغل ${jobNumber} — البنود تتبعها الفاتورة حتى التسليم`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={!canIssue}>
                {pending && <Loader2 className="animate-spin" />}
                {paying > 0 ? `إصدار وتحصيل ${formatKWD(paying)}` : 'إصدار الفاتورة'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {blocked && (
              <div className="rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
                <p className="font-semibold">سعّر هذه البنود أولاً — صفرُها ليس مجاناً:</p>
                <ul className="mt-1 list-inside list-disc">
                  {unpriced.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ما سيُطالَب به — بنداً بنداً كما سيُطبع */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)]">
              <ul className="divide-y divide-[var(--line)] text-[13px]">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 px-3.5 py-2">
                    <span className="text-[var(--text-1)]">{l.label}</span>
                    <span className="tnum shrink-0 font-semibold text-[var(--text-0)]">
                      {formatKWD(l.total)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-[13px]">
                <span className="text-[var(--text-2)]">المجموع</span>
                <span className="tnum font-bold text-[var(--text-0)]">{formatKWD(subtotal)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field label="خصم (د.ك)">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  max={subtotal}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  dir="ltr"
                  className="tnum text-start"
                  placeholder="0.000"
                />
              </Field>
              <Field label="سبب الخصم" hint={discountValue > 0 ? 'يُطبع بجانب الخصم' : undefined}>
                <Input
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  placeholder="عميل دائم، عرض…"
                  disabled={discountValue <= 0}
                />
              </Field>
            </div>

            {/* عربونٌ أو المبلغ كلّه — أو لا شيء فتصدر آجلة */}
            <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[var(--text-0)]">دفعة الآن</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(total > 0 ? total.toFixed(3) : '')}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] text-[var(--text-2)] hover:border-accent hover:text-accent"
                  >
                    المبلغ كلّه
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] text-[var(--text-2)] hover:border-accent hover:text-accent"
                  >
                    بلا دفعة
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="المبلغ (د.ك)">
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    max={total}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr"
                    className="tnum text-start"
                    placeholder="عربون أو المبلغ كلّه"
                  />
                </Field>
                <Field label="طريقة الدفع">
                  <Select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    disabled={paying <= 0}
                  >
                    {ISSUE_METHODS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {paying > 0 && method !== 'CASH' && (
                <Field label="رقم العملية / المرجع">
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
              )}
            </div>

            {tooMuchDiscount ? (
              <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                الخصم أكبر من قيمة الفاتورة
              </p>
            ) : tooMuchPaid ? (
              <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                الدفعة أكبر من الإجمالي <span className="tnum font-bold">{formatKWD(total)}</span>
              </p>
            ) : (
              <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px]">
                <SummaryRow label="الإجمالي" value={formatKWD(total)} strong />
                {paying > 0 && <SummaryRow label="يُحصَّل الآن" value={formatKWD(paying)} tone="text-ok" />}
                <SummaryRow
                  label={left > 0 ? 'يبقى مستحقاً' : 'الحالة'}
                  value={left > 0 ? formatKWD(left) : 'مسدَّدة بالكامل'}
                  tone={left > 0 ? 'text-warn' : 'text-ok'}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--text-2)]">{label}</span>
      <span className={cn('tnum', strong ? 'font-bold text-[var(--text-0)]' : 'font-semibold', tone)}>
        {value}
      </span>
    </div>
  );
}

export function IssueWarrantyButton({
  jobOrderId,
  paintParts = [],
}: {
  jobOrderId: string;
  /** لوحات الصبغ الدائم ورنقاته في هذا الأمر — تُعلَّم سلفاً في كفالته */
  paintParts?: string[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ subject: '', months: '12', terms: '' });
  /** الأجزاء المكفولة — فارغة تعني الموضوع كلّه */
  const [parts, setParts] = useState<string[]>([]);
  const byParts = warrantyHasParts(values.subject);
  const paintSubject = values.subject === 'صبغ دائم';
  // خيارات الأجزاء تتبع الموضوع: قطع الحماية للحماية، ولوحات الصبغ ورنقاته للصبغ
  const partOptions: Array<{ key: string; label: string }> = paintSubject
    ? [
        ...PAINT_PARTS.map((p) => ({ key: p.key, label: p.label })),
        ...paintParts
          .filter((k) => k.startsWith('rims:'))
          .map((k) => ({ key: k, label: warrantyPartLabels([k])[0] })),
      ]
    : BODY_PARTS.map((p) => ({ key: p.key, label: p.label }));

  function togglePart(key: string) {
    setParts((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  function submit() {
    startTransition(async () => {
      const res = await issueWarranty({ jobOrderId, ...values, parts: byParts ? parts : [] });
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
              <Button onClick={submit} disabled={pending || !values.subject}>
                {pending && <Loader2 className="animate-spin" />}
                إصدار
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/*
              مواضيع الكفالة لا الخدمات: أكثر الخدمات لا كفالة لها، وبعضها
              يُكفَل بتفصيل أدقّ منها. واختيار الموضوع يجلب مدّته المعتادة
              فلا تُكتب من الذاكرة في كل مرة.
            */}
            <Field label="موضوع الكفالة">
              <Select
                value={values.subject}
                onChange={(e) => {
                  const def = warrantySubject(e.target.value);
                  setValues((v) => ({
                    ...v,
                    subject: e.target.value,
                    months: def ? String(def.months) : v.months,
                  }));
                  // أجزاءُ موضوعٍ لا تخصّ غيره — والصبغ يبدأ بما صُبغ فعلاً في الأمر
                  setParts(e.target.value === 'صبغ دائم' ? paintParts : []);
                }}
              >
                <option value="">— اختر —</option>
                {WARRANTY_SUBJECTS.map((w) => (
                  <option key={w.label} value={w.label}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/*
              أجزاء البدي.
              الافتراض «البدي كلّه» لأنه الغالب عند أول تركيب. وتُحدَّد
              الأجزاء حين تُستبدل قطعةٌ بعد حادث: الفيلم الجديد يأخذ كفالةً
              من تاريخه هو، فتذكر شهادتُه ما تغطّيه دون بقيّة البدي.
            */}
            {byParts && (
              <Field
                label="الأجزاء المكفولة"
                hint={
                  parts.length === 0
                    ? paintSubject
                      ? 'بلا تحديد = السيارة كلّها'
                      : 'بلا تحديد = البدي كلّه'
                    : `${parts.length} من ${partOptions.length}`
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {partOptions.map((part) => {
                    const on = parts.includes(part.key);
                    return (
                      <button
                        key={part.key}
                        type="button"
                        onClick={() => togglePart(part.key)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                          on
                            ? 'border-accent bg-accent/15 text-accent-soft'
                            : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
                        )}
                      >
                        {part.label}
                      </button>
                    );
                  })}
                </div>
                {parts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setParts([])}
                    className="mt-2 text-[12px] text-accent hover:underline"
                  >
                    {paintSubject ? 'إلغاء التحديد — كفالة السيارة كلّها' : 'إلغاء التحديد — كفالة البدي كلّه'}
                  </button>
                )}
              </Field>
            )}

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
 * «تسعير البند» — بعد المعاينة، أو تصحيح سعرٍ قبل الفاتورة.
 * موافقة العميل اختيارية وتُسجَّل شاهداً؛ لا تمنع الشغل.
 */
export function PriceItemButton({
  itemId,
  jobOrderId,
  label,
  price,
  isPriced,
}: {
  itemId: string;
  jobOrderId: string;
  label: string;
  price: number;
  isPriced: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const initial = {
    price: isPriced ? String(price) : '',
    approved: false,
    method: 'WHATSAPP' as PriceApprovalMethod,
    note: '',
  };
  const [values, setValues] = useState(initial);

  function submit() {
    startTransition(async () => {
      const res = await setItemPrice({
        itemId,
        jobOrderId,
        price: values.price,
        approved: values.approved,
        method: values.approved ? values.method : null,
        note: values.note,
      });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      {isPriced ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="تعديل السعر"
          title="تعديل السعر"
          onClick={() => {
            setValues(initial);
            setOpen(true);
          }}
        >
          <Pencil />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setValues(initial);
            setOpen(true);
          }}
        >
          <Tag />
          تسعير
        </Button>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تسعير البند"
          description={label}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending || values.price === ''}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ السعر
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="السعر (د.ك)" hint={isPriced ? 'إعادة التسعير تمسح موافقة العميل السابقة' : undefined}>
              <Input
                type="number"
                min="0"
                step="0.001"
                autoFocus
                dir="ltr"
                className="tnum max-w-40 text-start"
                value={values.price}
                onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
              <input
                type="checkbox"
                checked={values.approved}
                className="size-4 accent-[var(--color-accent)]"
                onChange={(e) => setValues((v) => ({ ...v, approved: e.target.checked }))}
              />
              وافق العميل على هذا السعر
            </label>

            {values.approved && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="كيف وافق">
                  <Select
                    value={values.method}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, method: e.target.value as PriceApprovalMethod }))
                    }
                  >
                    {(Object.entries(PRICE_APPROVAL_METHODS) as [PriceApprovalMethod, string][]).map(
                      ([key, text]) => (
                        <option key={key} value={key}>
                          {text}
                        </option>
                      )
                    )}
                  </Select>
                </Field>
                <Field label="ملاحظة" hint="مع من، أو وقت الرسالة">
                  <Input
                    value={values.note}
                    onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/** تصحيح سجلّ الصبغ حتى التسليم — الكود والخلطة تُعرف غالباً عند الخلط لا عند الاستلام */
export function EditPaintButton({
  itemId,
  jobOrderId,
  detail,
}: {
  itemId: string;
  jobOrderId: string;
  detail: {
    finish: PaintFinish;
    colorName: string | null;
    paintCode: string | null;
    formula: string | null;
    repairNotes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const initial = {
    finish: detail.finish,
    colorName: detail.colorName ?? '',
    paintCode: detail.paintCode ?? '',
    formula: detail.formula ?? '',
    repairNotes: detail.repairNotes ?? '',
  };
  const [values, setValues] = useState(initial);

  function submit() {
    startTransition(async () => {
      const res = await updatePaintDetail({ itemId, jobOrderId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValues(initial);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
      >
        <Palette className="size-3.5" />
        تعديل سجلّ الصبغ
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="سجلّ الصبغ"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <ChoiceChips
              label="التشطيب"
              options={PAINT_FINISHES}
              value={values.finish}
              onPick={(finish) => setValues((v) => ({ ...v, finish }))}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="اسم اللون">
                <Input
                  value={values.colorName}
                  onChange={(e) => setValues((v) => ({ ...v, colorName: e.target.value }))}
                />
              </Field>
              <Field label="كود اللون">
                <Input
                  value={values.paintCode}
                  onChange={(e) => setValues((v) => ({ ...v, paintCode: e.target.value }))}
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
              <Field label="خلطة Glasurit">
                <Input
                  value={values.formula}
                  onChange={(e) => setValues((v) => ({ ...v, formula: e.target.value }))}
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
            </div>
            <Field label="الدعمات والخدوش">
              <Textarea
                rows={2}
                value={values.repairNotes}
                onChange={(e) => setValues((v) => ({ ...v, repairNotes: e.target.value }))}
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
