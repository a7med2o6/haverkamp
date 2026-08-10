import Link from 'next/link';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  neutral: 'text-[var(--text-1)] bg-[var(--glass-strong)]',
  accent: 'text-accent-soft bg-accent/15',
  ok: 'text-ok bg-ok/15',
  warn: 'text-warn bg-warn/15',
  danger: 'text-danger bg-danger/15',
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ??
    Icons.Circle;

  const body = (
    <div
      className={cn(
        'flex h-full items-start gap-3.5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)] transition-colors',
        href && 'hover:border-[var(--line-strong)]'
      )}
    >
      <div className={cn('grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)]', TONES[tone])}>
        <Cmp className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--text-2)]">{label}</p>
        <p className="tnum mt-0.5 text-xl font-bold text-[var(--text-0)]">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--text-2)]">{hint}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
