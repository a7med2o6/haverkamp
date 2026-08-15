'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { cn } from '@/lib/utils';
import { saveServiceContent } from '../../actions';
import type { ContentGroup } from '@/lib/service-content';
import type { ImageSlot } from '@/lib/page-images';
import { ImageSection } from '@/components/dashboard/image-section';

/**
 * محرّر محتوى صفحة الخدمة.
 * الأقسام مرتّبة كما تظهر للزائر، وكل حقل بعربيّه وإنجليزيّه جنباً إلى
 * جنب — فيرى المحرّر الصفحة كوحدة بدل البحث عن مفاتيح متفرّقة.
 */
export interface ServiceMeta {
  cardImage: string | null;
  heroImage: string | null;
  sortOrder: number;
  isActive: boolean;
  showInNav: boolean;
  ar: { name: string; tagline: string | null; shortDesc: string | null; metaTitle: string | null; metaDescription: string | null };
  en: { name: string | null; tagline: string | null; shortDesc: string | null; metaTitle: string | null; metaDescription: string | null };
}

export function ContentEditor({
  slug,
  groups,
  service,
  images,
  pageUrl,
}: {
  slug: string;
  groups: ContentGroup[];
  service: ServiceMeta;
  images: ImageSlot[];
  pageUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /** القيم المحرَّرة مفتاحاً بمفتاح */
  const [values, setValues] = useState(() => {
    const map: Record<string, { ar: string; en: string }> = {};
    for (const g of groups) for (const f of g.fields) map[f.key] = { ar: f.ar, en: f.en };
    return map;
  });

  const [meta, setMeta] = useState<ServiceMeta>(service);

  // أول قسم مفتوح والباقي مطويّ — الصفحة طويلة
  /** بدائل الصور المعدّلة — المفتاح إلى المسار الجديد */
  const [pics, setPics] = useState<Record<string, string>>({});

  const [open, setOpen] = useState<Record<string, boolean>>({ basics: true });

  const original = useMemo(() => {
    const map: Record<string, { ar: string; en: string }> = {};
    for (const g of groups) for (const f of g.fields) map[f.key] = { ar: f.ar, en: f.en };
    return map;
  }, [groups]);

  const metaDirty = useMemo(
    () => JSON.stringify(meta) !== JSON.stringify(service),
    [meta, service]
  );

  const dirtyKeys = useMemo(
    () =>
      Object.keys(values).filter(
        (k) => values[k].ar !== original[k].ar || values[k].en !== original[k].en
      ),
    [values, original]
  );

  /** عدد الحقول المعدّلة في كل قسم — يظهر كنقطة على رأس القسم */
  const dirtyByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      counts[g.id] = g.fields.filter((f) => dirtyKeys.includes(f.key)).length;
    }
    return counts;
  }, [groups, dirtyKeys]);

  const dirtyPics = useMemo(
    () => Object.keys(pics).filter((k) => pics[k] !== images.find((s) => s.key === k)?.url),
    [pics, images]
  );

  function set(key: string, locale: 'ar' | 'en', v: string) {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [locale]: v } }));
  }

  function setMetaField<K extends keyof ServiceMeta>(k: K, v: ServiceMeta[K]) {
    setMeta((prev) => ({ ...prev, [k]: v }));
  }

  function setLocale(locale: 'ar' | 'en', k: string, v: string) {
    setMeta((prev) => ({ ...prev, [locale]: { ...prev[locale], [k]: v } }));
  }

  function reset() {
    setValues(original);
    setMeta(service);
    setPics({});
    toast.info('تم التراجع عن التعديلات غير المحفوظة');
  }

  function save() {
    if (dirtyKeys.length === 0 && !metaDirty && dirtyPics.length === 0) return;

    if (!meta.ar.name.trim()) {
      toast.error('اسم الخدمة بالعربية مطلوب');
      setOpen((p) => ({ ...p, basics: true }));
      return;
    }

    const missing = dirtyKeys.find((k) => !values[k].ar.trim());
    if (missing) {
      toast.error('النص العربي مطلوب في كل الحقول');
      // نفتح القسم الذي فيه الحقل الناقص ليراه المحرّر
      const group = groups.find((g) => g.fields.some((f) => f.key === missing));
      if (group) setOpen((p) => ({ ...p, [group.id]: true }));
      return;
    }

    startTransition(async () => {
      const res = await saveServiceContent({
        slug,
        service: metaDirty ? meta : undefined,
        fields: dirtyKeys.map((k) => ({ key: k, ar: values[k].ar, en: values[k].en })),
        images: dirtyPics.length ? Object.fromEntries(dirtyPics.map((k) => [k, pics[k]])) : undefined,
      });

      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      {/* شريط الإجراءات — يبقى ظاهراً أثناء التمرير في صفحة طويلة */}
      <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-0)]/95 px-1 py-3 backdrop-blur">
        <p className="text-[13px] text-[var(--text-2)]">
          {dirtyKeys.length > 0 || metaDirty || dirtyPics.length > 0 ? (
            <span className="text-warn">
              {[
                metaDirty ? 'بيانات الخدمة' : null,
                dirtyKeys.length ? `${dirtyKeys.length} نصاً` : null,
                dirtyPics.length ? `${dirtyPics.length} صورة` : null,
              ]
                .filter(Boolean)
                .join(' و')}{' '}
              غير محفوظ
            </span>
          ) : (
            'لا تعديلات غير محفوظة'
          )}
        </p>

        <div className="flex items-center gap-2">
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
          >
            <ExternalLink className="size-4" />
            معاينة الصفحة
          </a>

          {(dirtyKeys.length > 0 || metaDirty || dirtyPics.length > 0) && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
              <RotateCcw />
              تراجع
            </Button>
          )}

          <Button size="sm" onClick={save} disabled={pending || (dirtyKeys.length === 0 && !metaDirty && dirtyPics.length === 0)}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            حفظ
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <ImageSection
          slots={images}
          values={pics}
          onChange={(key, url) => setPics((prev) => ({ ...prev, [key]: url }))}
          open={open.images ?? false}
          onToggle={() => setOpen((p) => ({ ...p, images: !p.images }))}
          dirty={dirtyPics.length}
        />

        {/* ── بيانات الخدمة: البطاقة والصور والظهور ── */}
        <Panel
          id="basics"
          title="بيانات الخدمة"
          hint="ما يظهر في بطاقة الخدمة بالصفحة الرئيسية"
          dirty={metaDirty ? 1 : 0}
          open={open.basics ?? false}
          onToggle={() => setOpen((p) => ({ ...p, basics: !p.basics }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم الخدمة">
              <Input value={meta.ar.name} onChange={(e) => setLocale('ar', 'name', e.target.value)} />
            </Field>
            <Field label="Service name">
              <Input
                value={meta.en.name ?? ''}
                onChange={(e) => setLocale('en', 'name', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="العنوان الفرعي">
              <Input
                value={meta.ar.tagline ?? ''}
                onChange={(e) => setLocale('ar', 'tagline', e.target.value)}
              />
            </Field>
            <Field label="Tagline">
              <Input
                value={meta.en.tagline ?? ''}
                onChange={(e) => setLocale('en', 'tagline', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="الوصف المختصر" className="sm:col-span-2">
              <Textarea
                value={meta.ar.shortDesc ?? ''}
                onChange={(e) => setLocale('ar', 'shortDesc', e.target.value)}
                className="min-h-16"
              />
            </Field>
            <Field label="Short description" className="sm:col-span-2">
              <Textarea
                value={meta.en.shortDesc ?? ''}
                onChange={(e) => setLocale('en', 'shortDesc', e.target.value)}
                className="min-h-16 text-start"
                dir="ltr"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <ImageField
              label="صورة البطاقة"
              hint="تظهر في شبكة الخدمات بالرئيسية"
              value={meta.cardImage}
              onChange={(v) => setMetaField('cardImage', v)}
            />
            <ImageField
              label="صورة رأس الصفحة"
              hint="الصورة الكبيرة أعلى صفحة الخدمة"
              value={meta.heroImage}
              onChange={(v) => setMetaField('heroImage', v)}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="ترتيب الظهور">
              <Input
                type="number"
                value={meta.sortOrder}
                onChange={(e) => setMetaField('sortOrder', Number(e.target.value) || 0)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <div className="flex flex-col justify-end gap-2.5 pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                <input
                  type="checkbox"
                  checked={meta.isActive}
                  onChange={(e) => setMetaField('isActive', e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                نشطة (تظهر على الموقع)
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--text-1)]">
                <input
                  type="checkbox"
                  checked={meta.showInNav}
                  onChange={(e) => setMetaField('showInNav', e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                تظهر في شبكة الخدمات بالرئيسية
              </label>
            </div>
          </div>
        </Panel>

        {groups.map((g) => {
          const isOpen = open[g.id] ?? false;
          const dirty = dirtyByGroup[g.id] ?? 0;

          return (
            <section
              key={g.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]"
            >
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [g.id]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-[var(--text-0)]">{g.title}</h2>
                    {dirty > 0 && (
                      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                        {dirty}
                      </span>
                    )}
                  </div>
                  {g.hint && <p className="mt-0.5 text-[12px] text-[var(--text-2)]">{g.hint}</p>}
                </div>

                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-[var(--text-2)] transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-[var(--line)] p-5">
                  {g.fields.map((f) => {
                    const v = values[f.key];
                    const changed = dirtyKeys.includes(f.key);

                    return (
                      <div key={f.key}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <label
                            htmlFor={`${f.key}-ar`}
                            className="text-[13px] font-medium text-[var(--text-1)]"
                          >
                            {f.label}
                            {changed && <span className="ms-1.5 text-warn">•</span>}
                          </label>
                          <code className="tnum text-[10px] text-[var(--text-2)]" dir="ltr">
                            {f.key}
                          </code>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {f.long ? (
                            <Textarea
                              id={`${f.key}-ar`}
                              value={v.ar}
                              onChange={(e) => set(f.key, 'ar', e.target.value)}
                              className="min-h-20"
                              placeholder="النص العربي"
                            />
                          ) : (
                            <Input
                              id={`${f.key}-ar`}
                              value={v.ar}
                              onChange={(e) => set(f.key, 'ar', e.target.value)}
                              placeholder="النص العربي"
                            />
                          )}

                          {f.long ? (
                            <Textarea
                              value={v.en}
                              onChange={(e) => set(f.key, 'en', e.target.value)}
                              className="min-h-20 text-start"
                              dir="ltr"
                              placeholder="English (optional)"
                            />
                          ) : (
                            <Input
                              value={v.en}
                              onChange={(e) => set(f.key, 'en', e.target.value)}
                              className="text-start"
                              dir="ltr"
                              placeholder="English (optional)"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* ── السيو: ما يظهر في نتائج البحث ── */}
        <Panel
          id="seo"
          title="محركات البحث"
          hint="العنوان والوصف كما يظهران في نتائج جوجل"
          dirty={0}
          open={open.seo ?? false}
          onToggle={() => setOpen((p) => ({ ...p, seo: !p.seo }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="عنوان الصفحة (عربي)">
              <Input
                value={meta.ar.metaTitle ?? ''}
                onChange={(e) => setLocale('ar', 'metaTitle', e.target.value)}
              />
            </Field>
            <Field label="Page title (English)">
              <Input
                value={meta.en.metaTitle ?? ''}
                onChange={(e) => setLocale('en', 'metaTitle', e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label="وصف الصفحة (عربي)">
              <Textarea
                value={meta.ar.metaDescription ?? ''}
                onChange={(e) => setLocale('ar', 'metaDescription', e.target.value)}
                className="min-h-16"
              />
            </Field>
            <Field label="Page description (English)">
              <Textarea
                value={meta.en.metaDescription ?? ''}
                onChange={(e) => setLocale('en', 'metaDescription', e.target.value)}
                className="min-h-16 text-start"
                dir="ltr"
              />
            </Field>
          </div>
        </Panel>
      </div>
    </>
  );
}

/** قسم قابل للطيّ — يوحّد شكل أقسام المحرّر */
function Panel({
  title,
  hint,
  dirty,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  dirty: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-[var(--surface-2)]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-[var(--text-0)]">{title}</h2>
            {dirty > 0 && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                معدّل
              </span>
            )}
          </div>
          {hint && <p className="mt-0.5 text-[12px] text-[var(--text-2)]">{hint}</p>}
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[var(--text-2)] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && <div className="border-t border-[var(--line)] p-5">{children}</div>}
    </section>
  );
}

/** رفع صورة مع معاينة */
function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[var(--text-1)]">{label}</p>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="size-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
        ) : (
          <div className="grid size-20 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] text-[11px] text-[var(--text-2)]">
            لا صورة
          </div>
        )}
        <div className="min-w-0 flex-1">
          <FileUpload value={value ?? ''} folder="services" onChange={onChange} />
          <p className="mt-1 text-[11px] text-[var(--text-2)]">{hint}</p>
        </div>
      </div>
    </div>
  );
}
