import type { BookingStatus, CustomerSource } from '@/generated/prisma/enums';

/** ما يحتاجه التقويم من الحجز — أخفّ من سجل الحجز الكامل */
export interface CalendarBooking {
  id: string;
  code: string;
  scheduledAt: Date;
  status: BookingStatus;
  name: string;
  car: string;
  service: string;
  hasJob: boolean;
  phone: string | null;
  plateNo: string | null;
  notes: string | null;
  source: CustomerSource;
  serviceKey: string | null;
  serviceSpec: string | null;
  customerId: string | null;
  vehicleId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  guestCar: string | null;
  confirmToken: string;
  jobOrder: { id: string; number: string } | null;
  reminderSentAt: Date | null;
  confirmedAt: Date | null;
  rescheduledAt: Date | null;
  scheduledAtLocal: string;
}

/** ألوان الحالة على حافة البطاقة — تُقرأ باللمحة دون قراءة النص */
export const STATUS_EDGE: Record<string, string> = {
  PENDING: 'border-s-[var(--mark-warn)]',
  CONFIRMED: 'border-s-[var(--mark-ok)]',
  IN_PROGRESS: 'border-s-[var(--mark-accent)]',
  COMPLETED: 'border-s-[var(--mark-violet)]',
  CANCELLED: 'border-s-[var(--mark-danger)]',
  NO_SHOW: 'border-s-[var(--mark-muted)]',
};

/**
 * دليل الألوان أسفل التقويم — الحالات الست كاملة.
 * كان يعرض أربعاً لأن لونين منها كانا متطابقين تقريباً فلا يفيد ذكرهما.
 */
export const LEGEND_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
