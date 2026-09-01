'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { cn, formatKWD, formatPhone } from '@/lib/utils';
import {
  GLASS_GROUPS,
  GLASS_PARTS,
  SERVICES,
  TINT_GRADES,
  optionParts,
} from '@/lib/intake';
import { createIntake } from '../actions';

export interface Brand {
  id: string;
  name: string;
  packages: Array<{ name: string; price: number }>;
}

/** حالة كل خدمة في النموذج */
interface LineState {
  on: boolean;
  /** الخيارات المختارة — واحد للمفردة، وأكثر للمتعدّدة كالنانو */
  options: string[];
  /** معرّف خدمة ماركة حماية البدي */
  brand: string;
  /** ماركة تُذكر بالاسم: فيلم العزل أو حماية الجام */
  brandName: string;
  price: string;
  /** درجة العزل لكل قطعة زجاج */
  grades: Record<string, string>;
}

const BLANK: LineState = { on: false, options: [], brand: '', brandName: '', price: '', grades: {} };

/**
 * «بيان تشغيل» — النسخة الرقمية من دفتر الاستلام.
 *
 * ترتيب الخدمات وأسماؤها كما في الورقة حرفياً، لأن الموظف يملأها أمام
 * العميل وقد حفظ الورقة عن ظهر قلب — وإعادة ترتيبها «منطقياً» تبطئه.
 *
 * ما تضيفه الورقة لا تعرفه: درجة العزل لكل قطعة زجاج، والقطع المشمولة
 * بالحماية، وموعد التسليم مكتوباً بدل أن يُقال شفهياً.
 */
export function IntakeForm({
  customers,
  brands,
}: {
  customers: Array<{ id: string; name: string; phone: string; vehicles: Array<{ id: string; label: string }> }>;
  brands: Brand[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [head, setHead] = useState({
    customerId: '',
    vehicleId: '',
    odometer: '',
    promisedAt: '',
    paperRef: '',
    intakeNotes: '',
  });

  const [lines, setLines] = useState<Record<string, LineState>>(
    Object.fromEntries(SERVICES.map((s) => [s.key, { ...BLANK }]))
  );

  const vehicles = customers.find((c) => c.id === head.customerId)?.vehicles ?? [];

  const total = useMemo(
    () =>
      Object.values(lines).reduce(
        (sum, l) => sum + (l.on ? Number(l.price) || 0 : 0),
        0
      ),
    [lines]
  );

  const chosen = Object.values(lines).filter((l) => l.on).length;

  function patch(key: string, next: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }));
  }

  /** يملأ درجة العزل لمجموعة قطع بضغطة — «السائق ومن بجانبه ٣٠٪» */
  function applyGroup(parts: readonly string[], grade: string) {
    setLines((prev) => ({
      ...prev,
      tint: {
        ...prev.tint,
        on: true,
        grades: { ...prev.tint.grades, ...Object.fromEntries(parts.map((p) => [p, grade])) },
      },
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const payload = SERVICES.filter((s) => lines[s.key].on).map((s) => {
      const l = lines[s.key];
      const parts = s.glassParts
        ? GLASS_PARTS.filter((p) => l.grades[p.key]).map((p) => ({
            label: p.label,
            spec: l.grades[p.key],
            employeeIds: [],
          }))
        : s.bodyParts
          ? optionParts(s, l.options).map((p) => ({
              label: p.label,
              spec: p.spec,
              employeeIds: [],
            }))
          : [];

      return {
        key: s.key,
        options: l.options,
        brand: l.brand || null,
        brandName: l.brandName || null,
        price: l.price || 0,
        parts,
      };
    });

    startTransition(async () => {
      const res = await createIntake({ ...head, lines: payload });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        router.push(`/dashboard/job-orders/${res.id}`);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-0)] sm:text-2xl">بيان تشغيل</h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            استلام سيارة — التوقيع يبقى على الورقة، وسجّل رقمها هنا للربط
          </p>
        </div>
      </div>

      {/* ── بيانات السيارة ── */}
      <Card>
        <CardHeader>
          <CardTitle>العميل والسيارة</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {/*
            قائمة بالبحث لا <select>.
            الاستلام يجري والعميل واقف، وقائمة بمئات الأسماء لا تُرشَّح
            تعني تمريراً أمامه. والبحث يشمل الرقم لأن الاستقبال كثيراً ما
            يعرفه ولا يتذكّر كيف كُتب الاسم.
          */}
          <Field label="العميل" className="sm:col-span-2" error={errors.customerId?.[0]}>
            <Combobox
              value={head.customerId}
              onChange={(v) => setHead({ ...head, customerId: v, vehicleId: '' })}
              placeholder="اكتب اسم العميل أو رقمه…"
              emptyLabel="لا يوجد عميل بهذا الاسم أو الرقم"
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
                hint: formatPhone(c.phone),
              }))}
            />
          </Field>

          <Field label="السيارة">
            <Select
              value={head.vehicleId}
              disabled={!head.customerId}
              onChange={(e) => setHead({ ...head, vehicleId: e.target.value })}
            >
              <option value="">— اختر السيارة —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="العداد (كم)">
            <Input
              type="number"
              min="0"
              value={head.odometer}
              onChange={(e) => setHead({ ...head, odometer: e.target.value })}
            />
          </Field>

          <Field
            label="موعد التسليم"
            hint="اكتبه بدل أن تقوله شفهياً — عليه يقوم تنبيه التأخير"
          >
            <Input
              type="datetime-local"
              value={head.promisedAt}
              onChange={(e) => setHead({ ...head, promisedAt: e.target.value })}
            />
          </Field>

          <Field label="رقم بيان التشغيل الورقي" hint="الرقم المطبوع على الدفتر">
            <Input
              inputMode="numeric"
              placeholder="2564"
              value={head.paperRef}
              onChange={(e) => setHead({ ...head, paperRef: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* ── الخدمة المطلوبة ── */}
      <Card>
        <CardHeader>
          <CardTitle>الخدمة المطلوبة</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {SERVICES.map((s) => {
            const l = lines[s.key];
            const brand = brands.find((b) => b.id === l.brand);

            return (
              <div
                key={s.key}
                className={cn(
                  'rounded-[var(--radius-sm)] border transition-colors',
                  l.on ? 'border-accent bg-accent/5' : 'border-[var(--line)]'
                )}
              >
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={l.on}
                    className="size-4 accent-[var(--color-accent)]"
                    onChange={(e) => patch(s.key, { on: e.target.checked })}
                  />
                  <span className="text-[14px] font-semibold text-[var(--text-0)]">
                    {s.label}
                  </span>
                </label>

                {l.on && (
                  <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
                    {/* الخيار الفرعي */}
                    {s.options && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.options.map((o) => {
                          const on = l.options.includes(o.key);
                          return (
                            <button
                              key={o.key}
                              type="button"
                              onClick={() => {
                                // المتعدّدة تتراكم، والمفردة يستبدل اختيارها
                                const next = s.multi
                                  ? on
                                    ? l.options.filter((x) => x !== o.key)
                                    : [...l.options, o.key]
                                  : [o.key];
                                const pkg = brand?.packages.find((p) => p.name === o.packageName);
                                patch(s.key, {
                                  options: next,
                                  price: pkg?.price ? String(pkg.price) : l.price,
                                });
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
                    )}

                    {/* الماركة */}
                    {s.needsBrand && (
                      <Field label="الماركة">
                        <Select
                          value={l.brand}
                          onChange={(e) => {
                            const b = brands.find((x) => x.id === e.target.value);
                            const opt = s.options?.find((o) => o.key === l.options[0]);
                            const pkg = b?.packages.find((p) => p.name === opt?.packageName);
                            patch(s.key, {
                              brand: e.target.value,
                              price: pkg?.price ? String(pkg.price) : l.price,
                            });
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
                    {s.brandOptions && (
                      <Field label={s.brandLabel ?? 'الماركة'}>
                        <Select
                          value={l.brandName}
                          onChange={(e) => patch(s.key, { brandName: e.target.value })}
                        >
                          <option value="">— اختر —</option>
                          {s.brandOptions.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    {/* درجة العزل لكل قطعة زجاج */}
                    {s.glassParts && (
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-[var(--text-2)]">تعبئة سريعة:</span>
                          {GLASS_GROUPS.map((g) => (
                            <div key={g.key} className="flex items-center gap-1">
                              <span className="text-[11px] text-[var(--text-1)]">{g.label}</span>
                              <Select
                                value=""
                                className="h-7 w-24 text-[11px]"
                                onChange={(e) =>
                                  e.target.value && applyGroup(g.parts, e.target.value)
                                }
                              >
                                <option value="">—</option>
                                {TINT_GRADES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          {GLASS_PARTS.map((p) => (
                            <div
                              key={p.key}
                              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-2.5 py-2"
                            >
                              <span className="w-40 shrink-0 text-[12px] text-[var(--text-1)]">
                                {p.label}
                              </span>
                              <Select
                                value={l.grades[p.key] ?? ''}
                                className="h-8 w-28 shrink-0 text-[12px]"
                                onChange={(e) =>
                                  patch(s.key, {
                                    grades: { ...l.grades, [p.key]: e.target.value },
                                  })
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
                      </div>
                    )}

                    {/*
                      القطع لا تُعرض هنا.
                      الباقة تحدّدها سلفاً والموظف يعرفها، فعرض أربع عشرة
                      قطعة أمام العميل ضجيج يطيل الاستلام بلا قرار جديد.
                      تُنشأ في الخلفية لتظهر في «توزيع الشغل» حين يحين وقتها.
                    */}
                    {s.bodyParts && optionParts(s, l.options).length > 0 && (
                      <p className="text-[11px] text-[var(--text-2)]">
                        {optionParts(s, l.options).length} قطعة تُنشأ للتوزيع على
                        الفنيين
                      </p>
                    )}

                    {/* السعر */}
                    <Field label="السعر (د.ك)" hint="اتركه صفراً إن كان ضمن الباقة">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        className="max-w-40"
                        value={l.price}
                        onChange={(e) => patch(s.key, { price: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* ── ملاحظات السيارة ── */}
      <Card>
        <CardHeader>
          <CardTitle>ملاحظات السيارة</CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="" hint="الخدوش والأضرار الموجودة قبل الاستلام">
            <Textarea
              rows={3}
              value={head.intakeNotes}
              onChange={(e) => setHead({ ...head, intakeNotes: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* شريط الإجمالي — يبقى مرئياً لأنه الرقم المتفق عليه مع العميل */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface-1)]/95 backdrop-blur lg:pe-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] text-[var(--text-2)]">
              {chosen} خدمة · المبلغ الإجمالي
            </p>
            <p className="tnum text-lg font-bold text-[var(--text-0)]">{formatKWD(total)}</p>
          </div>
          <Button type="submit" size="lg" disabled={pending || !head.customerId || chosen === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
            حفظ بيان التشغيل
          </Button>
        </div>
      </div>
    </form>
  );
}
