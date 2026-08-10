'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { Search, TriangleAlert, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmployeeListItem {
  id: string;
  fullName: string;
  civilId: string | null;
  code: string;
  photo: string | null;
  position: string;
  isActive: boolean;
  /** أقرب وثيقة على وشك الانتهاء — null إن كانت كلها سارية */
  expiry: { tone: 'warn' | 'danger'; label: string } | null;
}

export function EmployeeList({ employees }: { employees: EmployeeListItem[] }) {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [onlyExpiring, setOnlyExpiring] = useState(searchParams.get('expiring') === '1');

  const expiringCount = useMemo(
    () => employees.filter((e) => e.expiry).length,
    [employees]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (onlyExpiring && !e.expiry) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        (e.civilId ?? '').includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q)
      );
    });
  }, [employees, query, onlyExpiring]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--text-2)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الرقم…"
          aria-label="ابحث عن موظف"
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] ps-9 pe-3 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] focus:border-accent focus:outline-none"
        />
      </div>

      {/* تنبيه الوثائق — يحلّ محل صفحة المستندات المنفصلة */}
      {expiringCount > 0 && (
        <button
          onClick={() => setOnlyExpiring((v) => !v)}
          aria-pressed={onlyExpiring}
          className={cn(
            'flex items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-[12px] font-medium transition-colors',
            onlyExpiring
              ? 'border-warn bg-warn/15 text-warn'
              : 'border-warn/30 bg-warn/[0.07] text-warn hover:bg-warn/15'
          )}
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" />
            وثائق تحتاج تجديد
          </span>
          <span className="tnum rounded-full bg-warn/20 px-2 py-0.5">{expiringCount}</span>
        </button>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {filtered.length === 0 ? (
          <li className="rounded-[var(--radius-md)] border border-[var(--line)] p-6 text-center">
            <p className="text-[13px] text-[var(--text-2)]">
              {onlyExpiring ? 'لا توجد وثائق تحتاج تجديد' : 'لا توجد نتائج مطابقة'}
            </p>
          </li>
        ) : (
          filtered.map((e) => {
            const active = params?.id === e.id;
            return (
              <li key={e.id}>
                <Link
                  href={`/dashboard/hr/employees/${e.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--radius-md)] border p-3 transition-colors',
                    active
                      ? 'border-accent bg-accent/10'
                      : 'border-[var(--line)] bg-[var(--surface-1)] hover:border-[var(--line-strong)]'
                  )}
                >
                  <Avatar src={e.photo} name={e.fullName} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[13px] font-semibold',
                        active ? 'text-accent-soft' : 'text-[var(--text-0)]'
                      )}
                    >
                      {e.fullName}
                    </span>
                    <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
                      {e.civilId ?? e.code}
                    </span>
                    {e.expiry && (
                      <span
                        className={cn(
                          'mt-0.5 block text-[10px] font-medium',
                          e.expiry.tone === 'danger' ? 'text-danger' : 'text-warn'
                        )}
                      >
                        {e.expiry.label}
                      </span>
                    )}
                  </span>

                  {e.expiry && (
                    <span
                      title={e.expiry.label}
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        e.expiry.tone === 'danger' ? 'bg-danger' : 'bg-warn'
                      )}
                    />
                  )}
                  {!e.isActive && (
                    <span className="shrink-0 rounded-full bg-[var(--glass-strong)] px-2 py-0.5 text-[10px] text-[var(--text-2)]">
                      موقوف
                    </span>
                  )}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--text-2)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <User style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
