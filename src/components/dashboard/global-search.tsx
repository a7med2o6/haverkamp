'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { CarFront, Loader2, Search, UserRound, X } from 'lucide-react';
import { globalSearch } from '@/app/dashboard/search/actions';
import { cn, formatPhone } from '@/lib/utils';

type CustomerResult = {
  id: string;
  name: string;
  phone: string;
  code: string;
};

type VehicleResult = {
  plateNo: string | null;
  make: string;
  model: string;
  customer: { id: string; name: string };
};

type SearchResults = {
  customers: CustomerResult[];
  vehicles: VehicleResult[];
};

const EMPTY_RESULTS: SearchResults = { customers: [], vehicles: [] };

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestSequence = useRef(0);
  const previousPathname = useRef(pathname);
  const listboxId = useId();
  const customersHeadingId = useId();
  const vehiclesHeadingId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pending, startTransition] = useTransition();

  const destinations = [
    ...(results?.customers.map((customer) => ({
      href: `/dashboard/customers/${customer.id}`,
    })) ?? []),
    ...(results?.vehicles.map((vehicle) => ({
      href: `/dashboard/customers/${vehicle.customer.id}`,
    })) ?? []),
  ];

  const closeSearch = useCallback((restoreFocus = true) => {
    requestSequence.current += 1;
    setOpen(false);
    setQuery('');
    setResults(null);
    setError(null);
    setActiveIndex(-1);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openSearch = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      const slash = event.key === '/' && !isEditing && !event.metaKey && !event.ctrlKey && !event.altKey;

      if (!commandK && !slash) return;
      event.preventDefault();
      openSearch();
    };

    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [openSearch]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // الوجهة أخذت التركيز بعد الانتقال — إعادته إلى الزرّ تسحبه من الصفحة الجديدة
    closeSearch(false);
  }, [closeSearch, pathname]);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestSequence.current;
    if (term.length < 2) return;

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const response = await globalSearch({ q: term });
        if (requestSequence.current !== requestId) return;

        if (!response.ok) {
          setResults(EMPTY_RESULTS);
          setError(response.error);
          setActiveIndex(-1);
          return;
        }

        const data = response.data as SearchResults | undefined;
        const nextResults = data ?? EMPTY_RESULTS;
        setResults(nextResults);
        setError(null);
        setActiveIndex(nextResults.customers.length + nextResults.vehicles.length > 0 ? 0 : -1);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId]);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key === 'ArrowDown' && destinations.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % destinations.length);
      return;
    }

    if (event.key === 'ArrowUp' && destinations.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? destinations.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0 && event.target === inputRef.current) {
      event.preventDefault();
      const destination = destinations[activeIndex];
      if (!destination) return;
      closeSearch();
      router.push(destination.href);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]'
      ) ?? []
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setResults(null);
    setError(null);
    setActiveIndex(-1);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openSearch}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="فتح البحث عن عميل أو سيارة"
        className="flex size-9 min-w-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-0)] sm:h-9 sm:w-full sm:max-w-md sm:justify-start sm:gap-2.5 sm:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-start text-[13px] sm:block">
          ابحث عن عميل أو سيارة…
        </span>
        <kbd
          dir="ltr"
          className="tnum hidden h-5 items-center rounded border border-[var(--line)] bg-[var(--glass-strong)] px-1.5 text-[10px] font-medium text-[var(--text-2)] sm:inline-flex"
        >
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="البحث العام عن العملاء والسيارات"
            onKeyDown={handleDialogKeyDown}
            className="w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-card)] motion-reduce:transition-none"
          >
            <div className="flex h-14 items-center gap-3 border-b border-[var(--line)] px-4">
              <Search className="size-5 shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                aria-label="ابحث عن عميل أو سيارة"
                role="combobox"
                aria-expanded={results !== null}
                aria-controls={listboxId}
                aria-activedescendant={
                  activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
                }
                autoComplete="off"
                maxLength={60}
                placeholder="ابحث بالاسم أو الهاتف أو رقم اللوحة…"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--text-0)] caret-accent outline-none placeholder:text-[var(--text-2)]"
              />
              {pending ? (
                <Loader2
                  role="status"
                  aria-label="جارٍ البحث"
                  className="size-4 shrink-0 animate-spin text-[var(--text-2)] motion-reduce:animate-none"
                />
              ) : null}
              <button
                type="button"
                onClick={() => closeSearch()}
                aria-label="إغلاق البحث"
                className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--text-2)] transition-colors hover:bg-[var(--glass-strong)] hover:text-[var(--text-0)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
              {error ? (
                <p className="px-3 py-10 text-center text-[13px] text-danger">{error}</p>
              ) : query.trim().length < 2 ? (
                <p className="px-3 py-10 text-center text-[13px] text-[var(--text-2)]">
                  اكتب حرفين على الأقل للبحث بالاسم أو الهاتف أو رقم اللوحة
                </p>
              ) : pending && results === null ? (
                <p className="px-3 py-10 text-center text-[13px] text-[var(--text-2)]">
                  جارٍ البحث…
                </p>
              ) : results && destinations.length === 0 ? (
                <p className="px-3 py-10 text-center text-[13px] text-[var(--text-2)]">
                  لا توجد نتائج
                </p>
              ) : results ? (
                <div id={listboxId} role="listbox" aria-label="نتائج البحث" className="space-y-3">
                  {results.customers.length > 0 && (
                    <div role="group" aria-labelledby={customersHeadingId}>
                      <h2
                        id={customersHeadingId}
                        className="px-3 pb-1.5 pt-1 text-[11px] font-semibold text-[var(--text-2)]"
                      >
                        العملاء
                      </h2>
                      <div className="space-y-0.5">
                        {results.customers.map((customer, index) => (
                          <Link
                            key={customer.id}
                            id={`${listboxId}-option-${index}`}
                            href={`/dashboard/customers/${customer.id}`}
                            role="option"
                            aria-selected={activeIndex === index}
                            onMouseEnter={() => setActiveIndex(index)}
                            onFocus={() => setActiveIndex(index)}
                            onNavigate={() => closeSearch()}
                            className={cn(
                              'flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 outline-none transition-colors',
                              activeIndex === index
                                ? 'bg-accent/15 text-[var(--text-0)]'
                                : 'text-[var(--text-1)] hover:bg-[var(--glass-strong)]'
                            )}
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-accent">
                              <UserRound className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[var(--text-0)]">
                                {customer.name}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-2)]">
                                <span className="tnum" dir="ltr">
                                  {formatPhone(customer.phone)}
                                </span>
                                <span className="tnum" dir="ltr">
                                  {customer.code}
                                </span>
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.vehicles.length > 0 && (
                    <div role="group" aria-labelledby={vehiclesHeadingId}>
                      <h2
                        id={vehiclesHeadingId}
                        className="px-3 pb-1.5 pt-1 text-[11px] font-semibold text-[var(--text-2)]"
                      >
                        السيارات
                      </h2>
                      <div className="space-y-0.5">
                        {results.vehicles.map((vehicle, vehicleIndex) => {
                          const index = results.customers.length + vehicleIndex;
                          return (
                            <Link
                              key={
                                vehicle.plateNo ??
                                `${vehicle.customer.id}-${vehicle.make}-${vehicle.model}-${vehicleIndex}`
                              }
                              id={`${listboxId}-option-${index}`}
                              href={`/dashboard/customers/${vehicle.customer.id}`}
                              role="option"
                              aria-selected={activeIndex === index}
                              onMouseEnter={() => setActiveIndex(index)}
                              onFocus={() => setActiveIndex(index)}
                              onNavigate={() => closeSearch()}
                              className={cn(
                                'flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 outline-none transition-colors',
                                activeIndex === index
                                  ? 'bg-accent/15 text-[var(--text-0)]'
                                  : 'text-[var(--text-1)] hover:bg-[var(--glass-strong)]'
                              )}
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-accent">
                                <CarFront className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                  <span
                                    className="tnum text-[13px] font-semibold text-[var(--text-0)]"
                                    dir="ltr"
                                  >
                                    {vehicle.plateNo ?? 'بدون لوحة'}
                                  </span>
                                  <span className="truncate text-[12px] text-[var(--text-1)]">
                                    {vehicle.make} {vehicle.model}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-[var(--text-2)]">
                                  المالك: {vehicle.customer.name}
                                </span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
