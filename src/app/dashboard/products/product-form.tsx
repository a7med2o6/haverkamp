'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2, Pencil, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { PRODUCT_TYPE, STOCK_MOVEMENT, toOptions } from '@/lib/labels';
import { recordStockMovement, saveProduct } from './actions';

export interface ProductValues {
  id?: string;
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn?: string | null;
  type: string;
  categoryId?: string | null;
  serviceId?: string | null;
  description?: string | null;
  image?: string | null;
  unit: string;
  cost: number | string;
  price: number | string;
  trackStock: boolean;
  reorderLevel: number | string;
  isActive: boolean;
  showOnline: boolean;
}

export function ProductFormButton({
  product,
  categories,
  services,
  nextSku,
}: {
  product?: ProductValues;
  categories: Array<{ id: string; nameAr: string }>;
  services: Array<{ id: string; name: string }>;
  nextSku: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!product?.id;

  const [values, setValues] = useState<ProductValues>(
    product ?? {
      sku: nextSku,
      barcode: '',
      nameAr: '',
      nameEn: '',
      type: 'GOOD',
      categoryId: '',
      serviceId: '',
      description: '',
      image: '',
      unit: 'قطعة',
      cost: '',
      price: '',
      trackStock: true,
      reorderLevel: 0,
      isActive: true,
      showOnline: false,
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof ProductValues>(k: K, v: ProductValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveProduct(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  const isService = values.type === 'SERVICE';

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={isEdit ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل المنتج' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />منتج جديد</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل المنتج' : 'منتج جديد'}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="product-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="product-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم بالعربية" className="sm:col-span-2" error={errors.nameAr?.[0]}>
              <Input
                value={values.nameAr}
                onChange={(e) => set('nameAr', e.target.value)}
                required
                autoFocus
              />
            </Field>

            <Field label="الاسم بالإنجليزية">
              <Input
                value={values.nameEn ?? ''}
                onChange={(e) => set('nameEn', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="النوع">
              <Select value={values.type} onChange={(e) => set('type', e.target.value)}>
                {toOptions(PRODUCT_TYPE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="رمز الصنف (SKU)" error={errors.sku?.[0]}>
              <Input
                value={values.sku}
                onChange={(e) => set('sku', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="الباركود">
              <Input
                value={values.barcode ?? ''}
                onChange={(e) => set('barcode', e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="التصنيف">
              <Select
                value={values.categoryId ?? ''}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">— بدون تصنيف —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الخدمة المرتبطة" hint="لعرض المنتج في صفحة الخدمة بالموقع">
              <Select
                value={values.serviceId ?? ''}
                onChange={(e) => set('serviceId', e.target.value)}
              >
                <option value="">— بدون —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الوحدة" error={errors.unit?.[0]}>
              <Input
                value={values.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="قطعة، متر، علبة…"
                required
              />
            </Field>

            <Field label="التكلفة (د.ك)" error={errors.cost?.[0]}>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.cost}
                onChange={(e) => set('cost', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
              />
            </Field>

            <Field label="سعر البيع (د.ك)" error={errors.price?.[0]}>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.price}
                onChange={(e) => set('price', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                placeholder="0.000"
                required
              />
            </Field>

            {!isService && (
              <Field label="حد إعادة الطلب" hint="ينبّهك عند نزول الرصيد لهذا الحد">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={values.reorderLevel}
                  onChange={(e) => set('reorderLevel', e.target.value)}
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
            )}

            <Field label="الوصف" className="sm:col-span-2">
              <Textarea
                value={values.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                className="min-h-16"
              />
            </Field>

            {/* المتجر شبكة صور — منتج بلا صورة لا يظهر فيه مهما كان showOnline */}
            <div className="sm:col-span-2">
              <div className="flex items-start gap-4">
                {values.image ? (
                  <Image
                    src={values.image}
                    alt=""
                    width={96}
                    height={96}
                    className="shrink-0 rounded-[var(--radius-sm)] object-cover"
                    style={{ width: 96, height: 96 }}
                  />
                ) : (
                  <div
                    className="grid shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] text-[11px] text-[var(--text-2)]"
                    style={{ width: 96, height: 96 }}
                  >
                    لا صورة
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <FileUpload
                    value={values.image ?? ''}
                    folder="products"
                    onChange={(url) => set('image', url)}
                  />
                  {values.showOnline && !values.image && (
                    <p className="mt-1.5 text-xs text-warn">
                      المتجر يعرض المنتجات بصورها — بلا صورة لن يظهر هذا المنتج
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 sm:col-span-2">
              {!isService && (
                <Checkbox
                  label="متابعة المخزون"
                  checked={values.trackStock}
                  onChange={(v) => set('trackStock', v)}
                />
              )}
              <Checkbox
                label="نشط (يظهر في نقطة البيع)"
                checked={values.isActive}
                onChange={(v) => set('isActive', v)}
              />
              <Checkbox
                label="يظهر في متجر الموقع"
                checked={values.showOnline}
                onChange={(v) => set('showOnline', v)}
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

export function StockMovementButton({
  productId,
  productName,
  unit,
  stockQty,
}: {
  productId: string;
  productName: string;
  unit: string;
  stockQty: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    type: 'IN',
    qty: '',
    unitCost: '',
    reference: '',
    note: '',
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordStockMovement({ productId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم التسجيل');
        setOpen(false);
        setValues({ type: 'IN', qty: '', unitCost: '', reference: '', note: '' });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`حركة مخزون لـ ${productName}`}
        title="حركة مخزون"
      >
        <ArrowLeftRight />
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="حركة مخزون"
          description={`${productName} — الرصيد الحالي ${stockQty} ${unit}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="stock-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تسجيل الحركة
              </Button>
            </>
          }
        >
          <form id="stock-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع الحركة">
              <Select
                value={values.type}
                onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              >
                {toOptions(STOCK_MOVEMENT).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={values.type === 'ADJUST' ? `الرصيد الصحيح (${unit})` : `الكمية (${unit})`}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                value={values.qty}
                onChange={(e) => setValues((v) => ({ ...v, qty: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
                autoFocus
              />
            </Field>

            {(values.type === 'IN' || values.type === 'RETURN') && (
              <Field label="تكلفة الوحدة (د.ك)">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  value={values.unitCost}
                  onChange={(e) => setValues((v) => ({ ...v, unitCost: e.target.value }))}
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
            )}

            <Field label="المرجع">
              <Input
                value={values.reference}
                onChange={(e) => setValues((v) => ({ ...v, reference: e.target.value }))}
                placeholder="رقم فاتورة المورّد…"
              />
            </Field>

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.note}
                onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
                className="min-h-16"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
