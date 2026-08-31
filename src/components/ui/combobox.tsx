'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboOption {
  value: string;
  label: string;
  /** سطر ثانٍ للتمييز — رقم الهاتف مثلاً */
  hint?: string;
}

/**
 * حقل اختيار بالكتابة.
 *
 * الحقل نفسه حقل كتابة لا زرّ يفتح قائمة فيها حقل بحث: الموظف يستلم
 * والعميل واقف، فيكتب أول حروف الاسم مباشرة بدل نقرة تسبق كل بحث.
 * ولذلك تُرشَّح الخيارات مع أول حرف ولا تُنتظر نقرة أخرى.
 *
 * البحث يشمل التلميح لأن الاستقبال كثيراً ما يعرف رقم العميل ولا يتذكّر
 * كيف كُتب اسمه، ويتجاهل تنسيق الرقم فـ«55443322» يجد «+965 5544 3322».
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'اكتب للبحث أو اختر…',
  emptyLabel = 'لا نتائج',
  /** خيار ثابت أعلى القائمة لا يخضع للبحث */
  pinned,
  className,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  pinned?: ComboOption;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
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

  const list = pinned && !query.trim() ? [pinned, ...results] : results;

  /** الإغلاق يمسح البحث ويعيد النصّ إلى المختار */
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  function choose(next: string) {
    onChange(next);
    close();
    input.current?.blur();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return Math.max(0, Math.min(list.length - 1, next));
      });
    }
    if (e.key === 'Enter' && open && list[active]) {
      e.preventDefault();
      choose(list[active].value);
    }
  }

  return (
    <div ref={box} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={input}
          // مفتوحاً يعرض ما يُكتب، ومغلقاً يعرض المختار
          value={open ? query : (selected?.label ?? '')}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKey}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 pe-14 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] focus:border-accent focus:outline-none"
        />

        <div className="absolute inset-y-0 end-2 flex items-center gap-0.5">
          {selected && !open && (
            <button
              type="button"
              aria-label="مسح الاختيار"
              onClick={() => onChange('')}
              className="grid size-5 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            tabIndex={-1}
            onClick={() => (open ? close() : input.current?.focus())}
            className="grid size-5 place-items-center text-[var(--text-2)]"
          >
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-card)]">
          {list.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--text-2)]">
              {emptyLabel}
            </p>
          ) : (
            list.map((o, i) => (
              <button
                key={o.value || 'none'}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-start text-[13px] transition-colors',
                  i === active
                    ? 'bg-[var(--glass-strong)] text-[var(--text-0)]'
                    : 'text-[var(--text-1)]',
                  o.value === value && 'text-accent'
                )}
              >
                <span className="truncate">{o.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {o.hint && (
                    <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
                      {o.hint}
                    </span>
                  )}
                  {o.value === value && <Check className="size-3.5" />}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
