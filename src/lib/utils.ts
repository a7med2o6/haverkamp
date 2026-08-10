import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * تنسيق المبالغ بالدينار الكويتي (3 خانات عشرية).
 * نفرض الأرقام اللاتينية (`-u-nu-latn`) لأنها المعتمدة في الفواتير والتقارير المالية،
 * ولتتطابق مع بقية الأرقام في اللوحة.
 */
export function formatKWD(value: number | string | { toString(): string }, locale = 'ar-KW-u-nu-latn') {
  const n = typeof value === 'number' ? value : Number(value.toString());
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(n) ? n : 0);
}

/** رقم بدون رمز العملة */
export function formatNumber(value: number | string | { toString(): string }, digits = 3) {
  const n = typeof value === 'number' ? value : Number(value.toString());
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(d: Date | string | null | undefined, locale = 'ar-KW-u-nu-latn') {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, locale = 'ar-KW-u-nu-latn') {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** تحويل Decimal من Prisma إلى number بأمان للـ client components */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}
