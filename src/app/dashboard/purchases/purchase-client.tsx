'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, PackageCheck, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { formatKWD } from '@/lib/utils';
import {
  deletePurchaseItem,
  receivePurchase,
  savePurchaseItem,
  savePurchaseOrder,
  setPurchaseStatus,
} from './actions';

type Supplier = { id: string; name: string };

export function NewPurchaseButton({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ supplierId: '', expectedAt: '', shipping: '0', notes: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePurchaseOrder(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.push(`/dashboard/purchases/${res.id}`);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        أمر شراء جديد
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="أمر شراء جديد"
          description="أضف البنود بعد الإنشاء"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="po-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إنشاء
              </Button>
            </>
          }
        >
          <form id="po-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="المورّد" className="sm:col-span-2">
              <Select
                value={values.supplierId}
                onChange={(e) => setValues((v) => ({ ...v, supplierId: e.target.value }))}
              >
                <option value="">— بدون مورّد محدّد —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="تاريخ الوصول المتوقّع">
              <Input
                type="date"
                value={values.expectedAt}
                onChange={(e) => setValues((v) => ({ ...v, expectedAt: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="الشحن والجمارك (د.ك)" hint="يُوزَّع على الأصناف بنسبة قيمتها">
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.shipping}
                onChange={(e) => setValues((v) => ({ ...v, shipping: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
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

export function EditPurchaseButton({
  order,
  suppliers,
}: {
  order: { id: string; supplierId: string; expectedAt: string; shipping: string; notes: string };
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(order);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePurchaseOrder(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setValues(order);
          setOpen(true);
        }}
      >
        <Pencil />
        تعديل
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تعديل أمر الشراء"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="po-edit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="po-edit" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="المورّد" className="sm:col-span-2">
              <Select
                value={values.supplierId}
                onChange={(e) => setValues((v) => ({ ...v, supplierId: e.target.value }))}
              >
                <option value="">— بدون مورّد محدّد —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="تاريخ الوصول المتوقّع">
              <Input
                type="date"
                value={values.expectedAt}
                onChange={(e) => setValues((v) => ({ ...v, expectedAt: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="الشحن والجمارك (د.ك)" hint="يُوزَّع على الأصناف بنسبة قيمتها">
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.shipping}
                onChange={(e) => setValues((v) => ({ ...v, shipping: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
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

export function PurchaseItemForm({
  purchaseOrderId,
  products,
}: {
  purchaseOrderId: string;
  products: Array<{ id: string; nameAr: string; unit: string; cost: number }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ productId: '', qty: '1', unitCost: '' });

  function pick(id: string) {
    const p = products.find((x) => x.id === id);
    setValues((v) => ({ ...v, productId: id, unitCost: p ? String(p.cost) : v.unitCost }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePurchaseItem({ purchaseOrderId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setValues({ productId: '', qty: '1', unitCost: '' });
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const total = (Number(values.qty) || 0) * (Number(values.unitCost) || 0);

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
          title="إضافة بند لأمر الشراء"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="po-item" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إضافة
              </Button>
            </>
          }
        >
          <form id="po-item" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الصنف" className="sm:col-span-2">
              <Select value={values.productId} onChange={(e) => pick(e.target.value)} required>
                <option value="">— اختر الصنف —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </Select>
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

            <Field label="تكلفة الوحدة (د.ك)" hint="قبل الشحن">
              <Input
                type="number"
                step="0.001"
                min={0}
                value={values.unitCost}
                onChange={(e) => setValues((v) => ({ ...v, unitCost: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            {total > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] sm:col-span-2">
                <span className="text-[var(--text-2)]">إجمالي البند </span>
                <span className="tnum font-bold text-[var(--text-0)]">{formatKWD(total)}</span>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeletePurchaseItemButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="حذف البند"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deletePurchaseItem({ id });
          if (res.ok) {
            toast.success(res.message ?? 'تم الحذف');
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <Trash2 className="text-danger" />
    </Button>
  );
}

export function PurchaseStatusButtons({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: 'ORDERED' | 'CANCELLED') {
    startTransition(async () => {
      const res = await setPurchaseStatus({ id, status: next });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      {status === 'DRAFT' && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => set('ORDERED')}>
          <Send />
          تأكيد الطلب
        </Button>
      )}
      {(status === 'DRAFT' || status === 'ORDERED') && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => set('CANCELLED')}>
          <X />
          إلغاء الأمر
        </Button>
      )}
    </>
  );
}

/** استلام البضاعة — يقبل كميات جزئية ويحدّث المخزون والتكلفة */
export function ReceiveButton({
  purchaseOrderId,
  items,
}: {
  purchaseOrderId: string;
  items: Array<{ id: string; label: string; unit: string; outstanding: number }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const pendingItems = items.filter((i) => i.outstanding > 0);

  function fill() {
    // الافتراضي أن كل المتبقي وصل — والتعديل لمن وصل بعضه
    setQtys(Object.fromEntries(pendingItems.map((i) => [i.id, String(i.outstanding)])));
    setNote('');
    setOpen(true);
  }

  function submit() {
    const lines = pendingItems
      .map((i) => ({ itemId: i.id, qty: Number(qtys[i.id]) || 0 }))
      .filter((l) => l.qty > 0);

    if (lines.length === 0) {
      toast.error('حدّد كمية واحدة على الأقل');
      return;
    }

    startTransition(async () => {
      const res = await receivePurchase({ purchaseOrderId, lines, note });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (pendingItems.length === 0) return null;

  return (
    <>
      <Button variant="success" size="sm" onClick={fill}>
        <PackageCheck />
        استلام بضاعة
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="استلام بضاعة"
          description="الكميات الواصلة فعلاً — تُضاف للمخزون وتُحدّث تكلفة الصنف"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button variant="success" onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الاستلام
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {pendingItems.map((i) => (
              <div key={i.id} className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--text-0)]">{i.label}</p>
                  <p className="tnum text-[11px] text-[var(--text-2)]">
                    المتبقي للاستلام {i.outstanding} {i.unit}
                  </p>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={i.outstanding}
                  value={qtys[i.id] ?? ''}
                  onChange={(e) => setQtys((q) => ({ ...q, [i.id]: e.target.value }))}
                  dir="ltr"
                  className="tnum w-28 text-start"
                  aria-label={`الكمية المستلمة من ${i.label}`}
                />
              </div>
            ))}

            <Field label="ملاحظة">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="رقم البوليصة، حالة الشحنة…"
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
