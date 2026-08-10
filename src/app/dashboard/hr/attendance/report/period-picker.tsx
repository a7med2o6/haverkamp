'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/field';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function PeriodPicker({ month, year }: { month: number; year: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(key: 'month' | 'year', value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={month}
        onChange={(e) => go('month', e.target.value)}
        aria-label="الشهر"
        className="w-32"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </Select>
      <Select
        value={year}
        onChange={(e) => go('year', e.target.value)}
        aria-label="السنة"
        className="tnum w-24"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
