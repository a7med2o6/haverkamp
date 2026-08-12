'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { saveService, toggleServiceActive } from '../actions';

export interface ServiceValues {
  id: string;
  slug: string;
  cardImage?: string | null;
  heroImage?: string | null;
  sortOrder: number;
  isActive: boolean;
  showInNav: boolean;
  ar: {
    name: string;
    tagline?: string | null;
    shortDesc?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  en: {
    name?: string | null;
    tagline?: string | null;
    shortDesc?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
}

export function ServiceFormButton({ service }: { service: ServiceValues }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(service);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function setTop<K extends keyof ServiceValues>(k: K, v: ServiceValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function setLocale(locale: 'ar' | 'en', field: string, v: string) {
    setValues((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: v } }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveService(values);
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

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="تعديل الخدمة">
        <Pencil />
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`تعديل — ${values.ar.name}`}
          description="التعديل يظهر على الموقع فوراً بعد الحفظ"
          size="xl"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="service-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="service-form" onSubmit={onSubmit} className="space-y-6">
            {/* ── العربية ── */}
            <fieldset>
              <legend className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                المحتوى بالعربية
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم الخدمة" error={errors['ar.name']?.[0]}>
                  <Input
                    value={values.ar.name}
                    onChange={(e) => setLocale('ar', 'name', e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="العنوان الفرعي">
                  <Input
                    value={values.ar.tagline ?? ''}
                    onChange={(e) => setLocale('ar', 'tagline', e.target.value)}
                  />
                </Field>
                <Field label="الوصف المختصر" className="sm:col-span-2" hint="يظهر في بطاقة الخدمة بالصفحة الرئيسية">
                  <Textarea
                    value={values.ar.shortDesc ?? ''}
                    onChange={(e) => setLocale('ar', 'shortDesc', e.target.value)}
                    className="min-h-16"
                  />
                </Field>
              </div>
            </fieldset>

            {/* ── الإنجليزية ── */}
            <fieldset>
              <legend className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                المحتوى بالإنجليزية
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service name">
                  <Input
                    value={values.en.name ?? ''}
                    onChange={(e) => setLocale('en', 'name', e.target.value)}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
                <Field label="Tagline">
                  <Input
                    value={values.en.tagline ?? ''}
                    onChange={(e) => setLocale('en', 'tagline', e.target.value)}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
                <Field label="Short description" className="sm:col-span-2">
                  <Textarea
                    value={values.en.shortDesc ?? ''}
                    onChange={(e) => setLocale('en', 'shortDesc', e.target.value)}
                    dir="ltr"
                    className="min-h-16 text-start"
                  />
                </Field>
              </div>
            </fieldset>

            {/* ── الصور والترتيب ── */}
            <fieldset>
              <legend className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                الصور والعرض
              </legend>
              <div className="space-y-4">
                <FileUpload
                  value={values.cardImage ?? ''}
                  folder="services"
                  onChange={(url) => setTop('cardImage', url)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ترتيب الظهور" hint="الأصغر يظهر أولاً">
                    <Input
                      type="number"
                      value={values.sortOrder}
                      onChange={(e) => setTop('sortOrder', Number(e.target.value) || 0)}
                      dir="ltr"
                      className="tnum text-start"
                    />
                  </Field>
                  <div className="flex flex-col justify-end gap-2.5 pb-1">
                    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                      <input
                        type="checkbox"
                        checked={values.isActive}
                        onChange={(e) => setTop('isActive', e.target.checked)}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      نشطة (تظهر على الموقع)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                      <input
                        type="checkbox"
                        checked={values.showInNav}
                        onChange={(e) => setTop('showInNav', e.target.checked)}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      تظهر في شبكة الخدمات بالرئيسية
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── SEO ── */}
            <fieldset>
              <legend className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                تحسين محركات البحث
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="عنوان الصفحة (عربي)" hint="يظهر في نتائج جوجل">
                  <Input
                    value={values.ar.metaTitle ?? ''}
                    onChange={(e) => setLocale('ar', 'metaTitle', e.target.value)}
                  />
                </Field>
                <Field label="Page title (English)">
                  <Input
                    value={values.en.metaTitle ?? ''}
                    onChange={(e) => setLocale('en', 'metaTitle', e.target.value)}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
                <Field label="وصف الصفحة (عربي)">
                  <Textarea
                    value={values.ar.metaDescription ?? ''}
                    onChange={(e) => setLocale('ar', 'metaDescription', e.target.value)}
                    className="min-h-16"
                  />
                </Field>
                <Field label="Page description (English)">
                  <Textarea
                    value={values.en.metaDescription ?? ''}
                    onChange={(e) => setLocale('en', 'metaDescription', e.target.value)}
                    dir="ltr"
                    className="min-h-16 text-start"
                  />
                </Field>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ToggleServiceButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={isActive ? 'إخفاء من الموقع' : 'إظهار على الموقع'}
      title={isActive ? 'إخفاء من الموقع' : 'إظهار على الموقع'}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleServiceActive({ id, isActive: !isActive });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : isActive ? (
        <Eye className="text-ok" />
      ) : (
        <EyeOff className="text-[var(--text-2)]" />
      )}
    </Button>
  );
}
