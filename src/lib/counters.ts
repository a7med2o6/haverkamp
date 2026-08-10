import { db } from '@/lib/db';

const PREFIXES = {
  customer: 'HK-C',
  booking: 'HK-B',
  job: 'HK-J',
  invoice: 'HK-INV',
  purchase: 'HK-PO',
  employee: 'HK-E',
  warranty: 'HK-W',
} as const;

export type CounterKey = keyof typeof PREFIXES;

/**
 * يولّد رقم مستند تسلسلي بشكل ذرّي (atomic upsert).
 * مثال: HK-INV-0042
 */
export async function nextNumber(key: CounterKey, pad = 4): Promise<string> {
  const counter = await db.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIXES[key]}-${String(counter.value).padStart(pad, '0')}`;
}
