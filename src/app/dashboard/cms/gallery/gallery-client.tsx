'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { deleteGalleryItem, saveGalleryItem } from '../actions';

export interface GalleryValues {
  id?: string;
  imageUrl: string;
  captionAr?: string | null;
  captionEn?: string | null;
  serviceId?: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
}

const EMPTY: GalleryValues = {
  imageUrl: '',
  captionAr: '',
  captionEn: '',
  serviceId: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: true,
};

export function GalleryFormButton({
  item,
  services,
}: {
  item?: GalleryValues;
  services: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<GalleryValues>(item ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const isEdit = !!item?.id;

  function set<K extends keyof GalleryValues>(k: K, v: GalleryValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveGalleryItem(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        if (!isEdit) setValues(EMPTY);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={isEdit ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل الصورة' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />إضافة صورة</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل الصورة' : 'إضافة صورة للمعرض'}
          description="الصور المميّزة تظهر في معرض الصفحة الرئيسية"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="gallery-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="gallery-form" onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-start gap-4">
              {values.imageUrl ? (
                <Image
                  src={values.imageUrl}
                  alt=""
                  width={120}
                  height={84}
                  className="shrink-0 rounded-[var(--radius-sm)] object-cover"
                  style={{ width: 120, height: 84 }}
                />
              ) : (
                <div
                  className="grid shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] text-[11px] text-[var(--text-2)]"
                  style={{ width: 120, height: 84 }}
                >
                  لا صورة
                </div>
              )}
              <div className="min-w-0 flex-1">
                <FileUpload
                  value={values.imageUrl}
                  folder="gallery"
                  onChange={(url) => set('imageUrl', url)}
                />
                {errors.imageUrl?.[0] && (
                  <p className="mt-1 text-xs text-danger">{errors.imageUrl[0]}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الوصف (عربي)" hint="يُستخدم كنص بديل للصورة — مهم لمحركات البحث">
                <Input
                  value={values.captionAr ?? ''}
                  onChange={(e) => set('captionAr', e.target.value)}
                />
              </Field>
              <Field label="Caption (English)">
                <Input
                  value={values.captionEn ?? ''}
                  onChange={(e) => set('captionEn', e.target.value)}
                  dir="ltr"
                  className="text-start"
                />
              </Field>

              <Field label="الخدمة المرتبطة">
                <Select
                  value={values.serviceId ?? ''}
                  onChange={(e) => set('serviceId', e.target.value)}
                >
                  <option value="">— عام —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="ترتيب الظهور">
                <Input
                  type="number"
                  value={values.sortOrder}
                  onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
            </div>

            <div className="space-y-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                نشطة
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                <input
                  type="checkbox"
                  checked={values.isFeatured}
                  onChange={(e) => set('isFeatured', e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                تظهر في معرض الصفحة الرئيسية
              </label>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteGalleryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirming(true)}
        aria-label="حذف الصورة"
      >
        <Trash2 className="text-danger" />
      </Button>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف الصورة"
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
                    const res = await deleteGalleryItem({ id });
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
          <p className="text-sm text-[var(--text-1)]">
            ستُحذف الصورة من المعرض نهائياً. ملف الصورة نفسه يبقى على الخادم.
          </p>
        </Modal>
      )}
    </>
  );
}
