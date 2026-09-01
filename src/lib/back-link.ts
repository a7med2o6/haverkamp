/**
 * وجهة زرّ الرجوع.
 *
 * صفحات التفصيل تعود إلى قائمة قسمها دائماً، فمن فتح فاتورةً من ملف
 * عميلٍ ليقرأ رقماً وجد نفسه في قائمة الفواتير — بعيداً عمّا كان يقرأ،
 * ولا سبيل إليه إلا بحثاً من جديد.
 *
 * فيحمل الرابطُ من أين جاء، وتعود الصفحة إليه.
 *
 * وقيمة `from` تأتي من شريط العنوان فلا يُوثق بها: تُقبل المسارات
 * الداخلية وحدها. وما عداها — مسار خارجي أو `//host` أو محرف غريب —
 * يسقط إلى قائمة القسم، فلا يصير زرّ الرجوع باباً إلى موقع آخر.
 */
export interface BackTarget {
  href: string;
  label: string;
}

const INTERNAL = /^\/dashboard(\/[A-Za-z0-9._~-]+)*\/?$/;

/** اسم المكان كما يُقرأ في زرّ الرجوع */
const LABELS: Array<[RegExp, string]> = [
  [/^\/dashboard\/customers\/[^/]+$/, 'العودة إلى ملف العميل'],
  [/^\/dashboard\/customers$/, 'العودة إلى العملاء'],
  [/^\/dashboard\/job-orders\/[^/]+$/, 'العودة إلى أمر الشغل'],
  [/^\/dashboard\/job-orders$/, 'العودة إلى أوامر الشغل'],
  [/^\/dashboard\/invoices\/[^/]+$/, 'العودة إلى الفاتورة'],
  [/^\/dashboard\/invoices$/, 'العودة إلى الفواتير'],
  [/^\/dashboard\/warranties\/[^/]+$/, 'العودة إلى الكفالة'],
  [/^\/dashboard\/warranties$/, 'العودة إلى الكفالات'],
  [/^\/dashboard\/bookings$/, 'العودة إلى الحجوزات'],
  [/^\/dashboard\/vehicles\/[^/]+$/, 'العودة إلى السيارة'],
  [/^\/dashboard$/, 'العودة إلى النظرة العامة'],
];

export function backTo(from: string | undefined, fallback: BackTarget): BackTarget {
  if (!from || !INTERNAL.test(from)) return fallback;
  // النقطة محرف مقبول في الجزء، فـ«..» يجتاز الشكل ويخرج من اللوحة
  if (from.split('/').some((seg) => seg === '.' || seg === '..')) return fallback;

  const label = LABELS.find(([re]) => re.test(from))?.[1];
  return { href: from, label: label ?? 'رجوع' };
}

/** يُلحق مصدرَ الزيارة برابطٍ خارج — ليعرف المقصدُ من أين جاء */
export function withFrom(href: string, from: string) {
  return `${href}${href.includes('?') ? '&' : '?'}from=${encodeURIComponent(from)}`;
}
