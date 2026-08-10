'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmployeeListItem {
  id: string;
  fullName: string;
  civilId: string | null;
  code: string;
  photo: string | null;
  position: string;
  isActive: boolean;
}

export function EmployeeList({ employees }: { employees: EmployeeListItem[] }) {
  const params = useParams<{ id?: string }>();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        (e.civilId ?? '').includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q)
    );
  }, [employees, query]);

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

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {filtered.length === 0 ? (
          <li className="rounded-[var(--radius-md)] border border-[var(--line)] p-6 text-center">
            <p className="text-[13px] text-[var(--text-2)]">لا توجد نتائج مطابقة</p>
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
                  </span>
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
