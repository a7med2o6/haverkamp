'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboOption {
  value: string;
  label: string;
  /** سطر ثانٍ للتمييز — رقم الهاتف مثلاً */
  hint?: string;
}

/**
 * قائمة اختيار بالبحث.
 *
 * قائمة <select> الأصلية تصلح لعشرة خيارات لا لخمسمائة عميل: لا تُرشَّح
 * ولا تُطابَق إلا بأول حرف، فيضطرّ الموظف إلى التمرير أمام العميل. هنا
 * يكتب جزءاً من الاسم أو من الرقم فتُرشَّح القائمة.
 *
 * البحث يشمل التلميح لأن الاستقبال كثيراً ما يعرف رقم العميل ولا يتذكّر
 * كيف كُتب اسمه.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'اختر…',
  searchPlaceholder = 'اكتب للبحث…',
  emptyLabel = 'لا نتائج',
  /** خيار ثابت أعلى القائمة لا يخضع للبحث */
  pinned,
  className,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  pinned?: ComboOption;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const all = pinned ? [pinned, ...options] : options;
  const selected = all.find((o) => o.value === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // الأرقام تُطابَق بأرقامها وحدها: «965 5544» يجد «+965 5544 3322»
    const digits = q.replace(/\D/g, '');
    return options.filter((o) => {
      if (o.label.toLowerCase().includes(q)) return true;
      if (!o.hint) return false;
      if (o.hint.toLowerCase().includes(q)) return true;
      return digits.length > 0 && o.hint.replace(/\D/g, '').includes(digits);
    });
  }, [options, query]);

  /** الإغلاق يمسح البحث معه — قائمة تُفتح على بحث سابق تربك */
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // النقر خارج القائمة يغلقها — وإلا بقيت مفتوحة فوق بقية النموذج
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // مزامنة مع الـDOM لا مع حالة React — التركيز على الحقل عند الفتح
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function choose(next: string) {
    onChange(next);
    close();
  }

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 text-start text-sm text-[var(--text-0)] transition-colors hover:border-[var(--line-strong)] focus:border-accent focus:outline-none"
      >
        <span className={cn('truncate', !selected && 'text-[var(--text-2)]')}>
          {selected ? selected.label : placeholder}
          {selected?.hint && (
            <span className="tnum ms-2 text-[12px] text-[var(--text-2)]" dir="ltr">
              {selected.hint}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-2)]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]">
          <div className="relative border-b border-[var(--line)]">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--text-2)]" />
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent ps-9 pe-8 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="مسح البحث"
                className="absolute inset-y-0 end-2 my-auto text-[var(--text-2)] hover:text-[var(--text-0)]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {pinned && !query && (
              <Row option={pinned} active={value === pinned.value} onPick={choose} />
            )}
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-[var(--text-2)]">
                {emptyLabel}
              </p>
            ) : (
              results.map((o) => (
                <Row key={o.value} option={o} active={value === o.value} onPick={choose} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  option,
  active,
  onPick,
}: {
  option: ComboOption;
  active: boolean;
  onPick: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(option.value)}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-start text-[13px] transition-colors',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-[var(--text-1)] hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]'
      )}
    >
      <span className="truncate">{option.label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {option.hint && (
          <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
            {option.hint}
          </span>
        )}
        {active && <Check className="size-3.5" />}
      </span>
    </button>
  );
}
