'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { savePageContent } from '../../actions';
import type { ContentGroup } from '@/lib/service-content';

/**
 * محرّر محتوى الصفحات الأخرى (البنود · التواصل · الإكسسوارات).
 * نصوص فقط — صور هذه الصفحات إمّا من جداولها أو ثابتة في التصميم.
 */
export function PageEditor({
  page,
  groups,
  pageUrl,
}: {
  page: string;
  groups: ContentGroup[];
  pageUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState(() => {
    const map: Record<string, { ar: string; en: string }> = {};
    for (const g of groups) for (const f of g.fields) map[f.key] = { ar: f.ar, en: f.en };
    return map;
  });
  const [open, setOpen] = useState<Record<string, boolean>>({ [groups[0]?.id]: true });

  const original = useMemo(() => {
    const map: Record<string, { ar: string; en: string }> = {};
    for (const g of groups) for (const f of g.fields) map[f.key] = { ar: f.ar, en: f.en };
    return map;
  }, [groups]);

  const dirtyKeys = useMemo(
    () =>
      Object.keys(values).filter(
        (k) => values[k].ar !== original[k].ar || values[k].en !== original[k].en
      ),
    [values, original]
  );

  const dirtyByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) counts[g.id] = g.fields.filter((f) => dirtyKeys.includes(f.key)).length;
    return counts;
  }, [groups, dirtyKeys]);

  function set(key: string, locale: 'ar' | 'en', v: string) {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [locale]: v } }));
  }

  function save() {
    if (dirtyKeys.length === 0) return;

    const missing = dirtyKeys.find((k) => !values[k].ar.trim());
    if (missing) {
      toast.error('النص العربي مطلوب في كل الحقول');
      const group = groups.find((g) => g.fields.some((f) => f.key === missing));
      if (group) setOpen((p) => ({ ...p, [group.id]: true }));
      return;
    }

    startTransition(async () => {
      const res = await savePageContent({
        page,
        fields: dirtyKeys.map((k) => ({ key: k, ar: values[k].ar, en: values[k].en })),
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
      <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-0)]/95 px-1 py-3 backdrop-blur">
        <p className="text-[13px] text-[var(--text-2)]">
          {dirtyKeys.length > 0 ? (
            <span className="text-warn">{dirtyKeys.length} نصاً غير محفوظ</span>
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

          {dirtyKeys.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setValues(original);
                toast.info('تم التراجع عن التعديلات غير المحفوظة');
              }}
              disabled={pending}
            >
              <RotateCcw />
              تراجع
            </Button>
          )}

          <Button size="sm" onClick={save} disabled={pending || dirtyKeys.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            حفظ
          </Button>
        </div>
      </div>

      <div className="space-y-3">
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
      </div>
    </>
  );
}
