'use client';

import { ChevronDown, RotateCcw } from 'lucide-react';
import { FileUpload } from '@/components/ui/file-upload';
import { cn } from '@/lib/utils';
import type { ImageSlot } from '@/lib/page-images';

/**
 * قسم صور الصفحة.
 * كل خانة تعرض الصورة المستعملة فعلاً، وزرّ استعادة يعود للمسار الأصلي
 * المكتوب في الكود بدل ترك الخانة فارغة فتنكسر الصفحة.
 */
export function ImageSection({
  slots,
  values,
  onChange,
  open,
  onToggle,
  dirty,
}: {
  slots: ImageSlot[];
  values: Record<string, string>;
  onChange: (key: string, url: string) => void;
  open: boolean;
  onToggle: () => void;
  dirty: number;
}) {
  if (slots.length === 0) return null;

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
            <h2 className="text-[14px] font-bold text-[var(--text-0)]">صور الصفحة</h2>
            {dirty > 0 && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                {dirty}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
            {slots.length} صورة — الرفع يستبدلها على الموقع فوراً
          </p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[var(--text-2)] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-[var(--line)] p-5 sm:grid-cols-2">
          {slots.map((s) => {
            const url = values[s.key] ?? s.url;
            const changed = url !== s.url;
            const isDefault = url === s.fallback;

            return (
              <div key={s.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-[var(--text-1)]">
                    {s.label}
                    {changed && <span className="ms-1.5 text-warn">•</span>}
                  </p>
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => onChange(s.key, s.fallback)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--text-2)] hover:text-accent"
                    >
                      <RotateCcw className="size-3" />
                      الصورة الأصلية
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="size-20 shrink-0 rounded-[var(--radius-sm)] border border-[var(--line)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <FileUpload
                      value={url}
                      folder="pages"
                      onChange={(v) => onChange(s.key, v)}
                    />
                    {s.hint && <p className="mt-1 text-[11px] text-[var(--text-2)]">{s.hint}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
