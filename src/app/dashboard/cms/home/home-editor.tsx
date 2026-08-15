'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { saveHomeContent } from '../actions';
import type { ContentGroup } from '@/lib/service-content';

export interface HomeStats {
  'stats.years': number;
  'stats.clients': number;
  'stats.cars': number;
}

const STAT_LABELS: Record<keyof HomeStats, string> = {
  'stats.years': 'سنوات الخبرة',
  'stats.clients': 'عدد العملاء',
  'stats.cars': 'السيارات المحمية',
};

/**
 * محرّر محتوى الصفحة الرئيسية.
 * نفس تقسيم محرّر صفحات الخدمة، مع قسم لأرقام شريط الإحصائيات لأنها
 * قيم عددية في الإعدادات لا نصوص ترجمة.
 */
export function HomeEditor({ groups, stats }: { groups: ContentGroup[]; stats: HomeStats }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState(() => {
    const map: Record<string, { ar: string; en: string }> = {};
    for (const g of groups) for (const f of g.fields) map[f.key] = { ar: f.ar, en: f.en };
    return map;
  });
  const [nums, setNums] = useState<HomeStats>(stats);
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

  const dirtyStats = useMemo(
    () => (Object.keys(nums) as (keyof HomeStats)[]).filter((k) => nums[k] !== stats[k]),
    [nums, stats]
  );

  const dirtyByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) counts[g.id] = g.fields.filter((f) => dirtyKeys.includes(f.key)).length;
    return counts;
  }, [groups, dirtyKeys]);

  const hasChanges = dirtyKeys.length > 0 || dirtyStats.length > 0;

  function set(key: string, locale: 'ar' | 'en', v: string) {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [locale]: v } }));
  }

  function reset() {
    setValues(original);
    setNums(stats);
    toast.info('تم التراجع عن التعديلات غير المحفوظة');
  }

  function save() {
    if (!hasChanges) return;

    const missing = dirtyKeys.find((k) => !values[k].ar.trim());
    if (missing) {
      toast.error('النص العربي مطلوب في كل الحقول');
      const group = groups.find((g) => g.fields.some((f) => f.key === missing));
      if (group) setOpen((p) => ({ ...p, [group.id]: true }));
      return;
    }

    startTransition(async () => {
      const res = await saveHomeContent({
        fields: dirtyKeys.map((k) => ({ key: k, ar: values[k].ar, en: values[k].en })),
        stats: dirtyStats.length
          ? Object.fromEntries(dirtyStats.map((k) => [k, nums[k]]))
          : undefined,
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
          {hasChanges ? (
            <span className="text-warn">
              {[
                dirtyKeys.length ? `${dirtyKeys.length} نصاً` : null,
                dirtyStats.length ? 'أرقام الإحصائيات' : null,
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
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)] hover:text-accent"
          >
            <ExternalLink className="size-4" />
            معاينة الصفحة
          </a>

          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
              <RotateCcw />
              تراجع
            </Button>
          )}

          <Button size="sm" onClick={save} disabled={pending || !hasChanges}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            حفظ
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* أرقام شريط الإحصائيات — من الإعدادات لا الترجمات */}
        <Section
          title="أرقام شريط الإحصائيات"
          hint="الأرقام الثلاثة أسفل صورة الرئيسية"
          badge={dirtyStats.length}
          open={open.stats ?? false}
          onToggle={() => setOpen((p) => ({ ...p, stats: !p.stats }))}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(STAT_LABELS) as (keyof HomeStats)[]).map((k) => (
              <Field key={k} label={STAT_LABELS[k]}>
                <Input
                  type="number"
                  min={0}
                  value={nums[k]}
                  onChange={(e) =>
                    setNums((prev) => ({ ...prev, [k]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  dir="ltr"
                  className="tnum text-start"
                />
              </Field>
            ))}
          </div>
        </Section>

        {groups.map((g) => (
          <Section
            key={g.id}
            title={g.title}
            hint={g.hint}
            badge={dirtyByGroup[g.id] ?? 0}
            open={open[g.id] ?? false}
            onToggle={() => setOpen((p) => ({ ...p, [g.id]: !p[g.id] }))}
          >
            <div className="space-y-4">
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
          </Section>
        ))}
      </div>
    </>
  );
}

function Section({
  title,
  hint,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  badge: number;
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
            {badge > 0 && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                {badge}
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
