'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { deleteTestimonial, saveTestimonial } from '../actions';

export interface TestimonialValues {
  id?: string;
  author: string;
  avatar?: string | null;
  rating: number;
  bodyAr: string;
  bodyEn?: string | null;
  carModel?: string | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: TestimonialValues = {
  author: '',
  avatar: '',
  rating: 5,
  bodyAr: '',
  bodyEn: '',
  carModel: '',
  sortOrder: 0,
  isActive: true,
};

export function TestimonialFormButton({ item }: { item?: TestimonialValues }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<TestimonialValues>(item ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const isEdit = !!item?.id;

  function set<K extends keyof TestimonialValues>(k: K, v: TestimonialValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveTestimonial(values);
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
        aria-label={isEdit ? 'تعديل الرأي' : undefined}
      >
        {isEdit ? (
          <Pencil />
        ) : (
          <>
            <Plus />
            إضافة رأي
          </>
        )}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل رأي العميل' : 'إضافة رأي عميل'}
          description="الآراء المنشورة تظهر في قسم «آراء عملائنا» بالصفحة الرئيسية"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="testimonial-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="testimonial-form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم العميل" error={errors.author?.[0]}>
                <Input value={values.author} onChange={(e) => set('author', e.target.value)} />
              </Field>

              <Field label="السيارة" hint="مثال: لكزس LX 600">
                <Input
                  value={values.carModel ?? ''}
                  onChange={(e) => set('carModel', e.target.value)}
                />
              </Field>
            </div>

            <Field label="نص الرأي (عربي)" error={errors.bodyAr?.[0]}>
              <Textarea
                rows={3}
                value={values.bodyAr}
                onChange={(e) => set('bodyAr', e.target.value)}
              />
            </Field>

            <Field label="Review (English)" hint="اختياري — يظهر في النسخة الإنجليزية فقط">
              <Textarea
                rows={3}
                value={values.bodyEn ?? ''}
                onChange={(e) => set('bodyEn', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="التقييم" error={errors.rating?.[0]}>
                <Select
                  value={String(values.rating)}
                  onChange={(e) => set('rating', Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {'★'.repeat(n)} ({n})
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

            <FileUpload
              value={values.avatar ?? ''}
              folder="testimonials"
              onChange={(url) => set('avatar', url)}
            />

            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              منشور على الموقع
            </label>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteTestimonialButton({ id, author }: { id: string; author: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirming(true)}
        aria-label={`حذف رأي ${author}`}
      >
        <Trash2 className="text-danger" />
      </Button>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف الرأي"
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
                    const res = await deleteTestimonial({ id });
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
            سيُحذف رأي {author} نهائياً. لإخفائه مؤقتاً استخدم «تعديل» وألغِ «منشور على الموقع».
          </p>
        </Modal>
      )}
    </>
  );
}
