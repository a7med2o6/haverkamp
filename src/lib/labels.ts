/** تسميات عربية موحّدة لقيم الـ enums + لون الشارة المناسب */

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info';
type Label = { label: string; tone: Tone };

export const BOOKING_STATUS = {
  PENDING: { label: 'بانتظار التأكيد', tone: 'warn' },
  CONFIRMED: { label: 'مؤكد', tone: 'accent' },
  IN_PROGRESS: { label: 'قيد التنفيذ', tone: 'info' },
  COMPLETED: { label: 'منتهي', tone: 'ok' },
  CANCELLED: { label: 'ملغي', tone: 'neutral' },
  NO_SHOW: { label: 'لم يحضر', tone: 'danger' },
} satisfies Record<string, Label>;

export const JOB_STATUS = {
  RECEIVED: { label: 'تم الاستلام', tone: 'neutral' },
  IN_PROGRESS: { label: 'قيد التنفيذ', tone: 'info' },
  QUALITY_CHECK: { label: 'فحص جودة', tone: 'warn' },
  READY: { label: 'جاهز للتسليم', tone: 'accent' },
  DELIVERED: { label: 'تم التسليم', tone: 'ok' },
  CANCELLED: { label: 'ملغي', tone: 'danger' },
} satisfies Record<string, Label>;

export const ORDER_STATUS = {
  DRAFT: { label: 'معلّقة', tone: 'neutral' },
  COMPLETED: { label: 'مدفوعة', tone: 'ok' },
  PARTIAL: { label: 'مدفوعة جزئياً', tone: 'warn' },
  REFUNDED: { label: 'مرتجعة', tone: 'info' },
  CANCELLED: { label: 'ملغاة', tone: 'danger' },
} satisfies Record<string, Label>;

export const PAYMENT_METHOD = {
  CASH: { label: 'نقدي', tone: 'ok' },
  KNET: { label: 'كي نت', tone: 'accent' },
  VISA: { label: 'فيزا / ماستر', tone: 'accent' },
  TRANSFER: { label: 'تحويل بنكي', tone: 'info' },
  LINK: { label: 'رابط دفع', tone: 'info' },
  CREDIT: { label: 'آجل', tone: 'warn' },
} satisfies Record<string, Label>;

export const EMPLOYEE_STATUS = {
  ACTIVE: { label: 'على رأس العمل', tone: 'ok' },
  ON_LEAVE: { label: 'في إجازة', tone: 'warn' },
  SUSPENDED: { label: 'موقوف', tone: 'danger' },
  TERMINATED: { label: 'منتهي الخدمة', tone: 'neutral' },
} satisfies Record<string, Label>;

export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'حاضر', tone: 'ok' },
  ABSENT: { label: 'غائب', tone: 'danger' },
  LATE: { label: 'متأخر', tone: 'warn' },
  HALF_DAY: { label: 'نصف يوم', tone: 'info' },
  ON_LEAVE: { label: 'إجازة', tone: 'accent' },
  HOLIDAY: { label: 'عطلة', tone: 'neutral' },
} satisfies Record<string, Label>;

export const LEAVE_TYPE = {
  ANNUAL: { label: 'سنوية', tone: 'accent' },
  SICK: { label: 'مرضية', tone: 'warn' },
  UNPAID: { label: 'بدون راتب', tone: 'neutral' },
  EMERGENCY: { label: 'طارئة', tone: 'danger' },
  MATERNITY: { label: 'أمومة', tone: 'info' },
  HAJJ: { label: 'حج', tone: 'ok' },
} satisfies Record<string, Label>;

export const LEAVE_STATUS = {
  PENDING: { label: 'بانتظار الموافقة', tone: 'warn' },
  APPROVED: { label: 'موافق عليها', tone: 'ok' },
  REJECTED: { label: 'مرفوضة', tone: 'danger' },
  CANCELLED: { label: 'ملغاة', tone: 'neutral' },
} satisfies Record<string, Label>;

export const PAYROLL_STATUS = {
  DRAFT: { label: 'مسودة', tone: 'neutral' },
  APPROVED: { label: 'معتمد', tone: 'accent' },
  PAID: { label: 'مدفوع', tone: 'ok' },
} satisfies Record<string, Label>;

export const DOCUMENT_TYPE = {
  CIVIL_ID: { label: 'البطاقة', tone: 'accent' },
  PASSPORT: { label: 'الجواز', tone: 'info' },
  WORK_PERMIT: { label: 'إذن العمل', tone: 'accent' },
  RESIDENCY: { label: 'الإقامة', tone: 'accent' },
  RESIDENCY_APPLICATION: { label: 'طلب الإقامة', tone: 'neutral' },
  CONTRACT: { label: 'العقد', tone: 'neutral' },
  INSURANCE: { label: 'التأمين', tone: 'ok' },
  LICENSE: { label: 'رخصة قيادة', tone: 'info' },
  HEALTH_CERT: { label: 'شهادة صحية', tone: 'ok' },
  OTHER: { label: 'أخرى', tone: 'neutral' },
} satisfies Record<string, Label>;

/** بطاقات الوثائق في بروفايل الموظف — بالترتيب المعروض */
export const DOCUMENT_TILES = [
  { type: 'CIVIL_ID', label: 'البطاقة', icon: 'ContactRound' },
  { type: 'PASSPORT', label: 'الجواز', icon: 'Globe' },
  { type: 'WORK_PERMIT', label: 'إذن العمل', icon: 'FileBadge' },
  { type: 'CONTRACT', label: 'العقد', icon: 'FileSignature' },
  { type: 'RESIDENCY_APPLICATION', label: 'طلب الإقامة', icon: 'FileInput' },
  { type: 'INSURANCE', label: 'التأمين', icon: 'HeartPulse' },
] as const;

export const STOCK_MOVEMENT = {
  IN: { label: 'وارد', tone: 'ok' },
  OUT: { label: 'صادر', tone: 'warn' },
  ADJUST: { label: 'تسوية جرد', tone: 'info' },
  RETURN: { label: 'مرتجع', tone: 'accent' },
  DAMAGE: { label: 'تالف', tone: 'danger' },
} satisfies Record<string, Label>;

export const PURCHASE_STATUS = {
  DRAFT: { label: 'مسودة', tone: 'neutral' },
  ORDERED: { label: 'تم الطلب', tone: 'accent' },
  PARTIAL: { label: 'استلام جزئي', tone: 'warn' },
  RECEIVED: { label: 'تم الاستلام', tone: 'ok' },
  CANCELLED: { label: 'ملغي', tone: 'danger' },
} satisfies Record<string, Label>;

export const CUSTOMER_SOURCE = {
  WALK_IN: { label: 'زيارة مباشرة', tone: 'neutral' },
  WEBSITE: { label: 'الموقع', tone: 'accent' },
  WHATSAPP: { label: 'واتساب', tone: 'ok' },
  INSTAGRAM: { label: 'انستجرام', tone: 'info' },
  REFERRAL: { label: 'ترشيح', tone: 'accent' },
  GOOGLE_ADS: { label: 'إعلانات جوجل', tone: 'warn' },
  OTHER: { label: 'أخرى', tone: 'neutral' },
} satisfies Record<string, Label>;

export const PRODUCT_TYPE = {
  GOOD: { label: 'منتج', tone: 'accent' },
  SERVICE: { label: 'خدمة', tone: 'info' },
} satisfies Record<string, Label>;

/** يحوّل كائن تسميات إلى خيارات <select> */
export function toOptions<T extends Record<string, Label>>(map: T) {
  return (Object.keys(map) as Array<keyof T & string>).map((value) => ({
    value,
    label: map[value].label,
  }));
}
