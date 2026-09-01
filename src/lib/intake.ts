/**
 * «بيان تشغيل» — كتالوج نموذج الاستلام.
 *
 * هذا الملف هو النسخة الرقمية من الدفتر الورقي: نفس الخدمات الإحدى عشرة
 * بترتيبها وخياراتها الفرعية. مصدره الورقة لا قاعدة البيانات، لأن الورقة
 * تصف ما يُطلب عند الاستلام، وجدول الخدمات يصف ما يُعرض على الموقع —
 * وهما لا يتطابقان: الورقة تسأل عن مستوى التغطية ولا تسأل عن الماركة،
 * والجدول يعرّف الماركة ولا يعرف «بلاك أوت» ولا «تعقيم بالأوزون».
 */

export interface IntakeOption {
  key: string;
  label: string;
  /** اسم الباقة المقابل في جدول الخدمات — لجلب السعر وقائمة المحتويات */
  packageName?: string;
  /**
   * القطع التي تشملها هذه التغطية، ومقدار التغطية في كلٍّ منها.
   * مستوى التغطية يحدّدها بذاته — «بدي كامل» يعني البدي كلّه — فلا معنى
   * لأن يعلّمها الموظف قطعةً قطعة. تظهر جاهزة ليسند لكلٍّ منها فنيّها.
   */
  parts?: readonly { key: string; spec?: string }[];
}

export interface IntakeService {
  key: string;
  label: string;
  /** سلَق الخدمة في جدول الموقع — للربط حيث يوجد مقابل */
  slug?: string;
  /** الخيارات الفرعية */
  options?: IntakeOption[];
  /**
   * يقبل أكثر من خيار معاً.
   * النانو داخلي وخارجي يُطلبان في الطلب الواحد — وهما في الورقة مربّعا
   * اختيار لا زرّا راديو، فحصرهما في واحد كان مخالفة للورقة نفسها.
   */
  multi?: boolean;
  /**
   * يلزمه اختيار ماركة من جدول الخدمات — لها باقات وأسعار وكفالة.
   * خاصّ بحماية البدي: ماركاتها كيانات مسعّرة لا مجرّد أسماء.
   */
  needsBrand?: boolean;
  /**
   * ماركات تُختار بالاسم ولا مقابل لها في جدول الخدمات.
   * أفلام العزل وحماية الجام ماركات تُذكر في السجلّ والكفالة ولا تحمل
   * باقات مسعّرة، فتُخزَّن اسماً في مواصفة البند لا معرّفاً.
   */
  brandOptions?: readonly string[];
  /** عنوان قائمة الماركة — «الماركة» أو «النوع» */
  brandLabel?: string;
  /** يُفصَّل إلى قطع زجاج بدرجة لكل قطعة */
  glassParts?: boolean;
  /** قطعه تُشتقّ من مستوى التغطية المختار لا يعلّمها الموظف */
  bodyParts?: boolean;
}

/** درجات العزل — كلها بكفالة خمس سنوات، فالدرجة لا تغيّر مدة الكفالة */
export const TINT_GRADES = ['شفاف', '10%', '30%', '50%'] as const;
export type TintGrade = (typeof TINT_GRADES)[number];

export const TINT_WARRANTY_MONTHS = 60;

/**
 * قطع الزجاج — وحدة الإسناد في العازل.
 *
 * القطعة الصغيرة في الباب لا تُفرد صفّاً: يركّبها الفني نفسه الذي ركّب
 * بابها، وكذلك زجاج الدبّة. إفرادها يضاعف الصفوف بلا معلومة جديدة.
 *
 * الدرجة تُختار غالباً بالمجموعة («السائق ومن بجانبه ٣٠٪») لكن الإسناد
 * يبقى بالقطعة، لأن كل باب قد يركّبه فني مختلف. لذلك القطعة هي الصفّ،
 * والمجموعة اختصار إدخال فقط.
 */
export const GLASS_PARTS = [
  { key: 'windshield', label: 'الجام الأمامي', group: 'front' },
  { key: 'driver_door', label: 'باب السائق', group: 'front_sides' },
  { key: 'passenger_door', label: 'باب الراكب الأمامي', group: 'front_sides' },
  { key: 'rear_left_door', label: 'الباب الخلفي — جهة السائق', group: 'rear' },
  { key: 'rear_right_door', label: 'الباب الخلفي — جهة الراكب', group: 'rear' },
  { key: 'rear_glass', label: 'جام الدبّة', group: 'rear' },
] as const;

export type GlassPartKey = (typeof GLASS_PARTS)[number]['key'];

/** اختصارات إدخال الدرجة — تملأ عدة قطع بضغطة */
export const GLASS_GROUPS = [
  { key: 'all', label: 'كل الجام', parts: GLASS_PARTS.map((p) => p.key) },
  { key: 'front', label: 'الأمامي', parts: ['windshield'] },
  { key: 'front_sides', label: 'السائق ومن بجانبه', parts: ['driver_door', 'passenger_door'] },
  { key: 'rear', label: 'باقي السيارة', parts: ['rear_left_door', 'rear_right_door', 'rear_glass'] },
] as const;

/**
 * قطع البدي — وحدة الإسناد في الحماية.
 * الأبواب تُجمَّع بالجهة لأن الفني يأخذ الجهة كاملة، بينما تُفرَد المداقر
 * لأنها تُوزَّع فرادى. هذا ما تصفه الورشة فعلاً لا ما يصفه كتالوج سيارات.
 */
export const BODY_PARTS = [
  { key: 'hood', label: 'الكبوت' },
  { key: 'front_bumper', label: 'الدعامية الأمامية' },
  { key: 'fender_fr', label: 'المدقر الأمامي — يمين' },
  { key: 'fender_fl', label: 'المدقر الأمامي — يسار' },
  { key: 'pillars', label: 'ذراعات الجام الأمامي' },
  { key: 'roof_edge', label: 'بداية السقف' },
  { key: 'door_edges', label: 'أطراف الأبواب' },
  { key: 'fuel_door', label: 'تانك البنزين' },
  { key: 'doors_right', label: 'الأبواب الجانبية — يمين' },
  { key: 'doors_left', label: 'الأبواب الجانبية — يسار' },
  { key: 'fender_rr', label: 'المدقر الخلفي — يمين' },
  { key: 'fender_rl', label: 'المدقر الخلفي — يسار' },
  { key: 'trunk', label: 'الدبّة' },
  { key: 'rear_bumper', label: 'الدعامية الخلفية' },
  { key: 'mirrors', label: 'المرايا' },
  { key: 'roof', label: 'السقف' },
] as const;

export type BodyPartKey = (typeof BODY_PARTS)[number]['key'];

/**
 * ماركات أفلام الحماية — تُقرأ من جدول الخدمات لأنها تحمل الأسعار
 * والباقات. هذه القائمة تحدّد أيّ الخدمات تُعدّ ماركة حماية.
 */
export const PROTECTION_BRAND_SLUGS = [
  'haverkamp',
  'clif',
  'iron',
  'xpel',
  'hexis',
] as const;

/**
 * الخدمات كما في الورقة.
 * أسماء الباقات هنا هي أسماء جدول الخدمات لا أسماء الورقة: الورقة تقول
 * «ستاندر» و«بدي كامل»، والجدول يقول «نص كبوت» و«فل بدي» — اسمان لشيء
 * واحد. نعرض اسم الورقة للموظف ونربط بالجدول خلف الستار.
 */
/**
 * ما تشمله كل تغطية.
 *
 * «ستاندر» و«كبوت كامل» متطابقتان إلا في قطعتين: الكبوت والمداقر
 * الأمامية — نصفهما في الأولى وكاملهما في الثانية. لذلك يبقى اسم القطعة
 * واحداً ويحمل `spec` مقدار التغطية، بدل قائمتي أسماء متشابهتين تختلفان
 * بكلمة «نصف» فتُقرآن خطأً عند التنفيذ.
 *
 * «بداية السقف» داخلة في كل التغطيات، و«السقف» كاملاً خارج «بدي كامل»
 * — نصّ الباقة نفسه: «حماية فل بدي باستثناء السقف».
 */
const FRONT_SHARED = [
  { key: 'front_bumper', spec: 'كامل' },
  { key: 'pillars' },
  { key: 'roof_edge' },
  { key: 'door_edges' },
  { key: 'fuel_door' },
] as const;

const STANDARD_PARTS = [
  { key: 'hood', spec: 'نصف' },
  { key: 'fender_fr', spec: 'نصف' },
  { key: 'fender_fl', spec: 'نصف' },
  ...FRONT_SHARED,
] as const;

const HOOD_FULL_PARTS = [
  { key: 'hood', spec: 'كامل' },
  { key: 'fender_fr', spec: 'كامل' },
  { key: 'fender_fl', spec: 'كامل' },
  ...FRONT_SHARED,
] as const;

/*
  «فل بدي» يستثني قطعتين:

  · السقف — نصّ الباقة نفسه: «حماية فل بدي باستثناء السقف».
  · تانك البنزين — لأنه جزء من المدقر الخلفي الذي يقع عليه، يميناً أو
    يساراً حسب موديل السيارة، والمدقران الخلفيان مشمولان هنا. فإفراده
    بنداً يجعل القطعة الواحدة تُحسب مرتين وتُسنَد لفنيَّين لا يعرف أحدهما
    أن الآخر غطّاها. وهو في «ستاندر» و«كبوت كامل» بند مستقل فعلاً، لأن
    المداقر الخلفية خارج تينك التغطيتين.
*/
const FULL_BODY_EXCLUDED = ['roof', 'fuel_door'];

const FULL_BODY_PARTS = BODY_PARTS.filter(
  (p) => !FULL_BODY_EXCLUDED.includes(p.key)
).map((p) => ({ key: p.key, spec: 'كامل' }));

/*
  كتالوج الخدمات — مصدر واحد.

  كان كتالوجان: واحد للحجز وواحد لبيان التشغيل، فتفرّقا حتى صار «بوليش»
  في أحدهما و«تلميع خارجي» و«تلميع داخلي» في الآخر، وماركات العزل في
  أحدهما دون الآخر — فيُحجز بخدمة لا وجود لها عند الاستلام.

  الترتيب ترتيب الطلب لا ترتيب الورقة: الحماية أولاً لأنها القرار الأكبر
  والأغلى، ثم العازل، ثم ما يُضاف إليهما.
*/
export const SERVICES: IntakeService[] = [
  {
    key: 'body',
    label: 'حماية البدي',
    slug: 'protication',
    needsBrand: true,
    bodyParts: true,
    options: [
      { key: 'standard', label: 'ستاندر', packageName: 'نص كبوت', parts: STANDARD_PARTS },
      { key: 'hood_full', label: 'كبوت كامل', packageName: 'كبوت كامل', parts: HOOD_FULL_PARTS },
      { key: 'full_body', label: 'بدي كامل', packageName: 'فل بدي', parts: FULL_BODY_PARTS },
    ],
  },
  {
    key: 'tint',
    label: 'العازل الحراري',
    slug: 'tint',
    glassParts: true,
    brandLabel: 'الماركة',
    brandOptions: ['صن تك', 'هافركامب', 'رويال شيلد'],
  },
  {
    key: 'front_glass',
    label: 'حماية الجام الأمامي',
    brandLabel: 'الماركة',
    // «إزالة فقط» ليست ماركة بل عمل آخر، لكنها اختيار في الموضع نفسه
    brandOptions: ['رويال شيلد', 'ASWF', 'ClearPlex', 'إزالة فقط'],
  },
  {
    key: 'glass_repair',
    label: 'إصلاح الجام',
    slug: 'glass',
    options: [
      { key: 'crack_injection', label: 'حقن شروخ' },
      { key: 'replacement', label: 'استبدال' },
    ],
  },
  { key: 'mats', label: 'تلبيس الدواسات' },
  { key: 'rims', label: 'حماية الرنقات' },
  { key: 'paint', label: 'صبغ رنقات', slug: 'paint' },
  {
    key: 'nano',
    label: 'نانو للمقاعد والرنقات',
    multi: true,
    options: [
      { key: 'interior', label: 'داخلي' },
      { key: 'exterior', label: 'خارجي' },
    ],
  },
  {
    // «تلميع خارجي» و«تلميع داخلي» كانا خدمتين، وهما خدمة بموضعين
    key: 'polish',
    label: 'بوليش',
    slug: 'polish',
    multi: true,
    options: [
      { key: 'exterior', label: 'خارجي' },
      { key: 'interior', label: 'داخلي' },
    ],
  },
  {
    key: 'wash',
    label: 'غسيل',
    slug: 'wash',
    multi: true,
    options: [
      { key: 'exterior', label: 'خارجي' },
      { key: 'interior', label: 'داخلي' },
    ],
  },
  { key: 'blackout', label: 'بلاك أوت' },
  { key: 'ozone', label: 'تعقيم وتعطير بتقنية الأوزون' },
];

export function serviceDef(key: string | null | undefined): IntakeService | undefined {
  return key ? SERVICES.find((s) => s.key === key) : undefined;
}

/** اسم البند كما يُكتب في أمر الشغل: «حماية البدي — بدي كامل» */
export function intakeLabel(
  service: IntakeService,
  optionKeys?: string | string[] | null
): string {
  const keys = optionKeys ? (Array.isArray(optionKeys) ? optionKeys : [optionKeys]) : [];
  const labels = keys
    .map((k) => service.options?.find((o) => o.key === k)?.label)
    .filter(Boolean);
  return labels.length > 0 ? `${service.label} — ${labels.join(' و')}` : service.label;
}


/** قطع التغطية المختارة بأسمائها ومقدار التغطية في كلٍّ منها */
export function optionParts(
  service: IntakeService,
  optionKeys: string | string[] | null | undefined
): Array<{ key: string; label: string; spec: string | null }> {
  const key = Array.isArray(optionKeys) ? optionKeys[0] : optionKeys;
  const option = key ? service.options?.find((o) => o.key === key) : undefined;
  return (option?.parts ?? []).map((p) => ({
    key: p.key,
    label: BODY_PARTS.find((b) => b.key === p.key)?.label ?? p.key,
    spec: p.spec ?? null,
  }));
}


/**
 * القطع التي لا يركّبها فني واحد.
 *
 * الفيلم على السطح الكبير يُفرد من طرفيه في وقت واحد وإلا حبس فقاعات أو
 * شدّ من جانب — فالكبوت والدعاميتان والدبّة والجام الأمامي عمل شخصين
 * لا اختيار. تُعلَّم هنا لينبّه النظام إن نقص الطاقم، فلا يُكتشف النقص
 * بعد أسابيع حين يُسأل «من ركّب هذه؟» فيظهر اسم واحد ونصف القصة.
 */
export const PAIR_PARTS = new Set<string>([
  'hood',
  'front_bumper',
  'rear_bumper',
  'trunk',
  'windshield',
]);

/** عدد الفنيين اللازم لقطعة */
export function crewFor(partKey: string): number {
  return PAIR_PARTS.has(partKey) ? 2 : 1;
}

/* ═══════════════════════════════════════════════════════════
   منظور الحجز على الكتالوج
   ═══════════════════════════════════════════════════════════ */

/**
 * الاختيار الواحد الذي يُسجَّل مع الحجز.
 *
 * الحجز طلبٌ لا أمر شغل: يكفيه ما يميّز الخدمة — الباقة إن كانت لها
 * باقات، وإلا الماركة. أمّا التفصيل (درجة كل زجاجة، قطع الحماية) فمكانه
 * الاستلام حيث تُعاين السيارة.
 */
export function bookingChoices(def: IntakeService | undefined): {
  label: string;
  values: string[];
} | null {
  if (!def) return null;
  if (def.options) {
    return { label: def.multi ? 'النوع' : 'الباقة', values: def.options.map((o) => o.label) };
  }
  if (def.brandOptions) {
    return { label: def.brandLabel ?? 'الماركة', values: [...def.brandOptions] };
  }
  return null;
}

/**
 * اسم خدمة الحجز للعرض.
 * الحجوزات القديمة وحجوزات الموقع لا تحمل مفتاح كتالوج، فترجع إلى اسم
 * الخدمة المرتبطة — فلا يظهر صفّ بلا خدمة لمجرّد أنه سابق للكتالوج.
 */
export function bookingServiceLabel(booking: {
  serviceKey?: string | null;
  serviceSpec?: string | null;
  service?: { translations: { name: string }[] } | null;
}): string | null {
  const def = serviceDef(booking.serviceKey);
  if (def) return booking.serviceSpec ? `${def.label} — ${booking.serviceSpec}` : def.label;
  return booking.service?.translations[0]?.name ?? null;
}
