import { db } from '@/lib/db';
import { MIGRATED_BRANDS, MIGRATED_SERVICES } from '@/lib/site-data';

/**
 * مخطّط محتوى صفحة الخدمة للتحرير.
 *
 * محتوى الصفحة موزّع على عشرات مفاتيح الترجمة (glass.s1.h3 …) فتحريره
 * كان يعني البحث وسط ٨٠٠ مفتاح. هنا نصفه كأقسام مطابقة لما يراه الزائر،
 * ونتكفّل بترجمة ذلك إلى مفاتيح عند القراءة والحفظ.
 */

export interface ContentField {
  /** مفتاح الترجمة الكامل */
  key: string;
  label: string;
  /** الحقول الطويلة تُعرض كمساحة نص */
  long?: boolean;
  ar: string;
  en: string;
}

export interface ContentGroup {
  id: string;
  title: string;
  /** يشرح للمحرّر أين يظهر هذا القسم في الصفحة */
  hint?: string;
  fields: ContentField[];
}

/** وصف حقل قبل تعبئته من قاعدة البيانات */
type FieldSpec = [suffix: string, label: string, long?: boolean];

interface GroupSpec {
  id: string;
  title: string;
  hint?: string;
  fields: FieldSpec[];
}

/** يبني أقسام صفحة الخدمة حسب عدد خطواتها ومميزاتها وأسئلتها */
function groupSpecs(slug: string): GroupSpec[] {
  const config = MIGRATED_SERVICES[slug];
  if (!config) return [];

  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  const specs: GroupSpec[] = [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'أول ما يراه الزائر — العنوان الكبير والفقرة تحته',
      fields: [
        ['hero.tag', 'السطر العلوي الصغير'],
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.sub', 'العنوان الفرعي'],
        ['hero.p', 'الفقرة التعريفية', true],
        ['tb1', 'شارة الثقة الأولى'],
        ['tb2', 'شارة الثقة الثانية'],
        ['tb3', 'شارة الثقة الثالثة'],
      ],
    },
    {
      id: 'steps',
      title: 'خطوات العمل',
      hint: `${config.steps} خطوات تظهر كبطاقات مرقّمة`,
      fields: [
        ['proc.tag', 'السطر العلوي'],
        ['proc.h2', 'عنوان القسم'],
        ['proc.p', 'وصف القسم', true],
        ...range(config.steps).flatMap<FieldSpec>((n) => [
          [`s${n}.h3`, `الخطوة ${n} — العنوان`],
          [`s${n}.p`, `الخطوة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'features',
      title: 'لماذا نحن',
      hint: `${config.features} مميزات`,
      fields: [
        ['why.tag', 'السطر العلوي'],
        ['why.h2', 'عنوان القسم'],
        ['why.p', 'وصف القسم', true],
        ...range(config.features).flatMap<FieldSpec>((n) => [
          [`w${n}.h3`, `الميزة ${n} — العنوان`],
          [`w${n}.p`, `الميزة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'gallery',
      title: 'معرض الأعمال',
      hint: 'الصور نفسها تُدار من «معرض الصور»',
      fields: [
        ['gal.tag', 'السطر العلوي'],
        ['gal.h2', 'عنوان القسم'],
        ['gal.p', 'وصف القسم', true],
      ],
    },
    {
      id: 'faq',
      title: 'الأسئلة الشائعة',
      hint: `${config.faqs} أسئلة`,
      fields: [
        ['faq.tag', 'السطر العلوي'],
        ['faq.h2', 'عنوان القسم'],
        ...range(config.faqs).flatMap<FieldSpec>((n) => [
          [`faq.${n}.q`, `السؤال ${n}`],
          [`faq.${n}.a`, `الإجابة ${n}`, true],
        ]),
      ],
    },
    {
      id: 'cta',
      title: 'دعوة للحجز',
      hint: 'الشريط أسفل الصفحة',
      fields: [
        ['cta.h2', 'العنوان'],
        ['cta.p', 'الوصف', true],
        ['cta.book', 'نص الزر'],
      ],
    },
    {
      id: 'nav',
      title: 'شريط التنقّل',
      hint: 'أسماء الأقسام في شريط أعلى الصفحة',
      fields: [
        ['nav.steps', 'رابط «خطوات العمل»'],
        ['nav.why', 'رابط «لماذا نحن»'],
      ],
    },
  ];

  // شريط الخامات يظهر أسفل الخطوات في الخدمات التي تعرّفه فقط
  if (config.materials?.length) {
    specs[1].fields.push(
      ...config.materials.map<FieldSpec>((name, i) => [`mat${i + 1}`, `الخامة «${name}» — الوصف`])
    );
  }

  return specs;
}

/**
 * أقسام صفحة الماركة (هافركامب/كلايف/أيرون).
 * الثلاث تتشارك البنية: نبذة وإحصائيات ومواصفات وباقات، وتختلف في
 * وجود بطاقات «أنواع الحماية» وفي بنود الباقة الأولى.
 */
function brandGroupSpecs(slug: string): GroupSpec[] {
  const config = MIGRATED_BRANDS[slug];
  if (!config) return [];

  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  const specs: GroupSpec[] = [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'العنوان الكبير ولوحة شعار الماركة',
      fields: [
        ['hero.tag', 'السطر العلوي الصغير'],
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.sub', 'العنوان الفرعي'],
        ['hero.p', 'الفقرة التعريفية', true],
        ['hero.badge', 'شارة الشعار (بجوار العلم)'],
        ['hero.bsub', 'سطر أسفل الشعار'],
        ['tb1', 'شارة الثقة الأولى'],
        ['tb2', 'شارة الثقة الثانية'],
        ['tb3', 'شارة الثقة الثالثة'],
      ],
    },
    {
      id: 'about',
      title: 'نبذة عن الماركة',
      hint: 'الفقرات وأرقام الإحصائيات الثلاثة',
      fields: [
        ['about.tag', 'السطر العلوي'],
        ['about.h2', 'عنوان القسم'],
        ['about.p', 'وصف القسم', true],
        ['about.p2', 'الفقرة الأولى', true],
        ['about.p3', 'الفقرة الثانية', true],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`st${n}.num`, `الإحصائية ${n} — الرقم`],
          [`st${n}.lbl`, `الإحصائية ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'specs',
      title: 'المواصفات التقنية',
      hint: 'ست بطاقات: قيمة وشرح',
      fields: [
        ['specs.tag', 'السطر العلوي'],
        ['specs.h2', 'عنوان القسم'],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`sp${n}.val`, `المواصفة ${n} — القيمة`],
          [`sp${n}.lbl`, `المواصفة ${n} — الشرح`, true],
        ]),
      ],
    },
  ];

  if (config.finish) {
    specs.push({
      id: 'finish',
      title: 'أنواع الحماية',
      hint: 'ثلاث بطاقات بصور — شفاف ومطفي وتغيير لون',
      fields: [
        ['finish.tag', 'السطر العلوي'],
        ['finish.h2', 'عنوان القسم'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`f${n}.h3`, `النوع ${n} — العنوان`],
          [`f${n}.p`, `النوع ${n} — الشرح`, true],
        ]),
      ],
    });
  }

  specs.push(
    {
      id: 'gallery',
      title: 'معرض الأعمال',
      hint: 'الصور نفسها تُدار من «معرض الصور»',
      fields: [
        ['gal.tag', 'السطر العلوي'],
        ['gal.h2', 'عنوان القسم'],
        ['gal.p', 'وصف القسم', true],
      ],
    },
    {
      id: 'packages',
      title: 'الباقات والأسعار',
      hint: 'ثلاث باقات — الأسعار قابلة للتعديل هنا',
      fields: [
        ['pkg.tag', 'السطر العلوي'],
        ['pkg.h2', 'عنوان القسم'],
        ['pkg.p', 'وصف القسم', true],
        ['pkg1.badge', 'شارة الباقة الأولى'],
        ['pkg.badge', 'شارة الباقة الأولى (بديل)'],
        ['pkg.note', 'ملاحظة أسفل السعر'],
        ['pkg.unit', 'وحدة السعر'],
        ['pkg.wa', 'نص زر الطلب'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`pkg${n}.name`, `الباقة ${n} — الاسم`],
          [`pkg${n}.price`, `الباقة ${n} — السعر`],
        ]),
        // بنود الباقات: المشتركة ثم الخاصة بكل باقة
        ['p1f1', 'بند الباقة الأولى — الأول'],
        ['p1f6', 'بند الباقة الأولى — تلبيس الدواسات'],
        ['p1f8', 'بند الباقة الأولى — خدمة الونش'],
        ['p2f1', 'بند الباقة الثانية — الأول'],
        ['p3f1', 'بند الباقة الثالثة — الأول'],
      ],
    },
    {
      id: 'faq',
      title: 'الأسئلة الشائعة',
      hint: 'ستة أسئلة',
      fields: [
        ['faq.tag', 'السطر العلوي'],
        ['faq.h2', 'عنوان القسم'],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`faq.${n}.q`, `السؤال ${n}`],
          [`faq.${n}.a`, `الإجابة ${n}`, true],
        ]),
      ],
    },
    {
      id: 'cta',
      title: 'دعوة للحجز',
      hint: 'الشريط أسفل الصفحة',
      fields: [
        ['cta.h2', 'العنوان'],
        ['cta.p', 'الوصف', true],
        ['btn.book', 'نص الزر'],
      ],
    },
    {
      id: 'nav',
      title: 'شريط التنقّل',
      hint: 'أسماء الأقسام في شريط أعلى الصفحة',
      fields: [
        ['nav.about', 'رابط «نبذة»'],
        ['nav.specs', 'رابط «المواصفات»'],
        ['nav.packages', 'رابط «الباقات»'],
      ],
    }
  );

  // بنود الباقات المشتركة — تسمية مفاتيحها تختلف بين هافركامب والباقي
  const featPrefix = slug === 'haverkamp' ? 'pkg.feat' : 'feat';
  specs.find((g) => g.id === 'packages')!.fields.push(
    [`${featPrefix}.tint`, 'بند مشترك — العازل الحراري'],
    [`${featPrefix}.ws`, 'بند مشترك — حماية الجام'],
    [`${featPrefix}.nano.seats`, 'بند مشترك — نانو المقاعد'],
    [`${featPrefix}.nano.rims`, 'بند مشترك — نانو الرنجات'],
    [`${featPrefix}.san`, 'بند مشترك — التعقيم']
  );

  return specs;
}

/**
 * أقسام صفحة العازل الحراري.
 * أقسامها لا تشبه بقية الخدمات: درجات تظليل بنِسَبها وأرقام كفالة
 * وبطاقات علامات، فلها مخطّطها.
 */
function tintGroupSpecs(): GroupSpec[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  return [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'العنوان الكبير والفقرة تحته',
      fields: [
        ['hero.tag', 'السطر العلوي الصغير'],
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.sub', 'العنوان الفرعي'],
        ['hero.p', 'الفقرة التعريفية', true],
      ],
    },
    {
      id: 'benefits',
      title: 'مزايا العازل',
      hint: 'أربع بطاقات بأيقونات',
      fields: [
        ['ben.tag', 'السطر العلوي'],
        ['ben.h2', 'عنوان القسم'],
        ...range(4).flatMap<FieldSpec>((n) => [
          [`b${n}.h3`, `الميزة ${n} — العنوان`],
          [`b${n}.p`, `الميزة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'before-after',
      title: 'قبل وبعد',
      hint: 'شريحة المقارنة بالسحب',
      fields: [
        ['ba.tag', 'السطر العلوي'],
        ['ba.h2', 'عنوان القسم'],
        ['ba.p', 'وصف القسم', true],
      ],
    },
    {
      id: 'levels',
      title: 'درجات التظليل',
      hint: 'أربع درجات وثلاثة أرقام كفالة أسفلها',
      fields: [
        ['lvl.tag', 'السطر العلوي'],
        ['lvl.h2', 'عنوان القسم'],
        ['lvl.p', 'وصف القسم', true],
        ...range(4).flatMap<FieldSpec>((n) => [
          [`l${n}.pct`, `الدرجة ${n} — النسبة`],
          [`l${n}.h3`, `الدرجة ${n} — العنوان`],
          [`l${n}.p`, `الدرجة ${n} — الشرح`, true],
        ]),
        ['l4.badge', 'شارة «الحد الأقصى بالنظام»'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`w${n}.num`, `رقم الكفالة ${n}`],
          [`w${n}.label`, `رقم الكفالة ${n} — العنوان`],
          [`w${n}.desc`, `رقم الكفالة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'brands',
      title: 'العلامات المتوفرة',
      hint: 'أربع بطاقات بشعارات',
      fields: [
        ['brands.tag', 'السطر العلوي'],
        ['brands.h2', 'عنوان القسم'],
        ...range(4).flatMap<FieldSpec>((n) => [[`br${n}.name`, `العلامة ${n} — الاسم`]]),
        ['br1.origin', 'منشأ العلامة الأولى'],
        ['br.origin.us', 'منشأ العلامات الأمريكية (مشترك)'],
      ],
    },
    {
      id: 'gallery',
      title: 'معرض الأعمال',
      hint: 'الصور نفسها تُدار من «معرض الصور»',
      fields: [
        ['gal.tag', 'السطر العلوي'],
        ['gal.h2', 'عنوان القسم'],
      ],
    },
    {
      id: 'faq',
      title: 'الأسئلة الشائعة',
      hint: 'ستة أسئلة',
      fields: [
        ['faq.tag', 'السطر العلوي'],
        ['faq.h2', 'عنوان القسم'],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`faq.${n}.q`, `السؤال ${n}`],
          [`faq.${n}.a`, `الإجابة ${n}`, true],
        ]),
      ],
    },
    {
      id: 'cta',
      title: 'دعوة للحجز',
      hint: 'الشريط أسفل الصفحة',
      fields: [['cta.h2', 'العنوان']],
    },
    {
      id: 'nav',
      title: 'شريط التنقّل',
      hint: 'أسماء الأقسام في شريط أعلى الصفحة',
      fields: [
        ['nav.features', 'رابط «المزايا»'],
        ['nav.levels', 'رابط «الدرجات»'],
      ],
    },
  ];
}

/**
 * أقسام صفحة حماية البدي.
 * تجمع أنواع الحماية وبطاقات الماركات ومدخل استوديو الألوان.
 */
function ppfGroupSpecs(): GroupSpec[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  return [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'العنوان الكبير والفقرة تحته',
      fields: [
        ['hero.tag', 'السطر العلوي الصغير'],
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.sub', 'العنوان الفرعي'],
        ['hero.p', 'الفقرة التعريفية', true],
      ],
    },
    {
      id: 'before-after',
      title: 'قبل وبعد',
      hint: 'شريحة المقارنة بالسحب',
      fields: [
        ['ba.tag', 'السطر العلوي'],
        ['ba.h2', 'عنوان القسم'],
        ['ba.p', 'وصف القسم', true],
      ],
    },
    {
      id: 'finish',
      title: 'أنواع الحماية',
      hint: 'ثلاث بطاقات — شفاف ومطفي وتغيير لون',
      fields: [
        ['finish.tag', 'السطر العلوي'],
        ['finish.h2', 'عنوان القسم'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`f${n}.h3`, `النوع ${n} — العنوان`],
          [`f${n}.p`, `النوع ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'studio',
      title: 'استوديو الألوان',
      hint: 'مدخل تجربة تغيير اللون ثلاثي الأبعاد',
      fields: [
        ['csc.eyebrow', 'السطر العلوي'],
        ['csc.h3', 'العنوان'],
        ['csc.p', 'الوصف', true],
        ['csc.btn', 'نص الزر'],
      ],
    },
    {
      id: 'brands',
      title: 'العلامات المتوفرة',
      hint: 'ثلاث بطاقات تقود لصفحات الماركات',
      fields: [
        ['brands.tag', 'السطر العلوي'],
        ['brands.h2', 'عنوان القسم'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`b${n}.name`, `العلامة ${n} — الاسم`],
          [`b${n}.origin`, `العلامة ${n} — المنشأ`],
        ]),
        ['brand.more', 'نص «اعرف أكثر»'],
      ],
    },
    {
      id: 'faq',
      title: 'الأسئلة الشائعة',
      hint: 'ستة أسئلة',
      fields: [
        ['faq.tag', 'السطر العلوي'],
        ['faq.h2', 'عنوان القسم'],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`faq.${n}.q`, `السؤال ${n}`],
          [`faq.${n}.a`, `الإجابة ${n}`, true],
        ]),
      ],
    },
    {
      id: 'cta',
      title: 'دعوة للحجز',
      hint: 'الشريط أسفل الصفحة',
      fields: [['cta.h2', 'العنوان']],
    },
    {
      id: 'nav',
      title: 'شريط التنقّل',
      hint: 'أسماء الأقسام في شريط أعلى الصفحة',
      fields: [
        ['nav.finish', 'رابط «أنواع الحماية»'],
        ['nav.studio', 'رابط «استوديو الألوان»'],
        ['nav.brands', 'رابط «الماركات»'],
        ['nav.faq', 'رابط «الأسئلة» (مشترك بين الصفحات)'],
      ],
    },
  ];
}

/**
 * أقسام صفحة الغسيل.
 * وحدها من الخدمات لها باقات بأسعار وبنود وآراء عملاء خاصة بها.
 */
function washGroupSpecs(): GroupSpec[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  return [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'العنوان الكبير وشارات الثقة',
      fields: [
        ['hero.tag', 'السطر العلوي الصغير'],
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.sub', 'العنوان الفرعي'],
        ['hero.p', 'الفقرة التعريفية', true],
        ['tb1', 'شارة الثقة الأولى'],
        ['tb2', 'شارة الثقة الثانية'],
        ['tb3', 'شارة الثقة الثالثة'],
      ],
    },
    {
      id: 'packages',
      title: 'الباقات والأسعار',
      hint: 'ثلاث باقات — الأسعار والبنود قابلة للتعديل هنا',
      fields: [
        ['pkg.tag', 'السطر العلوي'],
        ['pkg.h2', 'عنوان القسم'],
        ['pkg.p', 'وصف القسم', true],
        ['pkg.from', 'وحدة السعر'],
        ['pkg1.badge', 'شارة الباقة الأولى'],
        ...range(3).flatMap<FieldSpec>((n) => [
          [`pkg${n}.name`, `الباقة ${n} — الاسم`],
          [`pkg${n}.price`, `الباقة ${n} — السعر`],
          [`pkg${n}.note`, `الباقة ${n} — الملاحظة`],
          [`pkg${n}.cta`, `الباقة ${n} — نص الزر`],
        ]),
      ],
    },
    {
      id: 'package-items',
      title: 'بنود الباقات',
      hint: 'نصوص تتكرّر بين الباقات — تعديلها يطال كل باقة تستعملها',
      fields: [
        ['f.seats.vip', 'تنظيف المقاعد (VIP)'],
        ['f.seats', 'تنظيف المقاعد'],
        ['f.floors', 'غسيل الأرضيات والسقف'],
        ['f.mat', 'تنظيف سجادة الدواسات'],
        ['f.dash', 'تلميع لوحة التحكم'],
        ['f.tire', 'تلميع الكاوتش'],
        ['f.vents', 'تنظيف فتحات التهوية'],
        ['f.rims', 'تنظيف الرنجات'],
        ['f.wax', 'وكس الكار'],
        ['f.san', 'التعقيم'],
        ['f.san.combo', 'التعقيم والفومشين'],
        ['f.all.combo', 'التعقيم والفومشين والتعطير'],
        ['f.foam', 'الفومشين'],
        ['f.frag', 'التعطير'],
        ['f.nylon', 'نايلون الحماية'],
        ['f.nylon.vip', 'نايلون الحماية (VIP)'],
      ],
    },
    {
      id: 'why',
      title: 'لماذا نحن',
      hint: 'ست بطاقات',
      fields: [
        ['why.tag', 'السطر العلوي'],
        ['why.h2', 'عنوان القسم'],
        ['why.p', 'وصف القسم', true],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`w${n}.h3`, `الميزة ${n} — العنوان`],
          [`w${n}.p`, `الميزة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'gallery',
      title: 'معرض الأعمال',
      hint: 'الصور نفسها تُدار من «معرض الصور»',
      fields: [
        ['gal.tag', 'السطر العلوي'],
        ['gal.h2', 'عنوان القسم'],
        ['gal.p', 'وصف القسم', true],
      ],
    },
    {
      id: 'reviews',
      title: 'آراء العملاء',
      hint: 'ستة آراء خاصة بصفحة الغسيل — منفصلة عن آراء الرئيسية',
      fields: [
        ['rev.tag', 'السطر العلوي'],
        ['rev.h2', 'عنوان القسم'],
        ['rev.p', 'وصف القسم', true],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`rev.${n}.name`, `الرأي ${n} — الاسم`],
          [`rev.${n}.car`, `الرأي ${n} — السيارة`],
          [`rev.${n}.t`, `الرأي ${n} — النص`, true],
        ]),
      ],
    },
    {
      id: 'cta',
      title: 'دعوة للحجز',
      hint: 'الشريط أسفل الصفحة',
      fields: [
        ['cta.h2', 'العنوان'],
        ['cta.p', 'الوصف', true],
      ],
    },
    {
      id: 'nav',
      title: 'شريط التنقّل',
      hint: 'أسماء الأقسام في شريط أعلى الصفحة',
      fields: [
        ['nav.packages', 'رابط «الباقات»'],
        ['nav.why', 'رابط «لماذا نحن»'],
        ['nav.reviews', 'رابط «الآراء»'],
      ],
    },
  ];
}

/** يختار مخطّط الأقسام حسب نوع الصفحة */
function specsFor(slug: string): { prefix: string; specs: GroupSpec[] } | null {
  if (MIGRATED_SERVICES[slug]) {
    return { prefix: MIGRATED_SERVICES[slug].prefix, specs: groupSpecs(slug) };
  }
  if (MIGRATED_BRANDS[slug]) {
    return { prefix: MIGRATED_BRANDS[slug].prefix, specs: brandGroupSpecs(slug) };
  }
  if (slug === 'tint') return { prefix: 'tint', specs: tintGroupSpecs() };
  if (slug === 'protication') return { prefix: 'ppf', specs: ppfGroupSpecs() };
  if (slug === 'wash') return { prefix: 'wash', specs: washGroupSpecs() };
  return null;
}

/** كل مفاتيح صفحة الخدمة بالترتيب الذي تظهر به */
export function serviceContentKeys(slug: string): string[] {
  const found = specsFor(slug);
  if (!found) return [];

  return found.specs.flatMap((g) => g.fields.map(([suffix]) => `${found.prefix}.${suffix}`));
}

/** يقرأ محتوى صفحة الخدمة مجمّعاً في أقسام جاهزة للتحرير */
export async function getServiceContent(slug: string): Promise<ContentGroup[]> {
  const found = specsFor(slug);
  if (!found) return [];

  const { prefix, specs } = found;
  const keys = specs.flatMap((g) => g.fields.map(([suffix]) => `${prefix}.${suffix}`));

  const rows = await db.translation.findMany({
    where: { key: { in: keys } },
    select: { key: true, ar: true, en: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return specs
    .map((g) => ({
      id: g.id,
      title: g.title,
      hint: g.hint,
      fields: g.fields
        // المفاتيح البديلة تُعرَّف لكل الصفحات ولا توجد إلا في بعضها
        .filter(([suffix]) => byKey.has(`${prefix}.${suffix}`))
        .map(([suffix, label, long]) => {
          const key = `${prefix}.${suffix}`;
          const row = byKey.get(key)!;
          return { key, label, long: long ?? false, ar: row.ar, en: row.en ?? '' };
        }),
    }))
    .filter((g) => g.fields.length > 0);
}

/* ═══════════════════ الصفحة الرئيسية ═══════════════════ */

/**
 * أقسام الصفحة الرئيسية.
 * بطاقات الخدمات وآراء العملاء وصور المعرض تأتي من جداولها، فلا نكرّرها
 * هنا — ونكتفي بعناوين أقسامها وأوصافها.
 */
function homeGroupSpecs(): GroupSpec[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  const pad = (n: number) => String(n).padStart(2, '0');

  return [
    {
      id: 'hero',
      title: 'رأس الصفحة',
      hint: 'العنوان الكبير وسطور الاعتماد والشارات',
      fields: [
        ['hero.h1', 'العنوان الرئيسي', true],
        ['hero.cred1', 'سطر الاعتماد الأول', true],
        ['hero.cred2', 'سطر الاعتماد الثاني', true],
        ['hero.tagline', 'الجملة التسويقية', true],
        ['hero.lede', 'الفقرة التعريفية', true],
        ['hero.badge.certified', 'شارة الصورة — منشأة معتمدة'],
        ['hero.badge.warranty', 'شارة الصورة — الكفالة'],
        ['hero.badge.cars', 'شارة الصورة — عدد السيارات'],
        ['hero.strip.years', 'شريط الأرقام — سنوات الخبرة'],
        ['hero.strip.clients', 'شريط الأرقام — العملاء'],
        ['hero.strip.cars', 'شريط الأرقام — السيارات'],
      ],
    },
    {
      id: 'services',
      title: 'قسم الخدمات',
      hint: 'العنوان فقط — البطاقات نفسها تُدار من «الخدمات»',
      fields: [
        ['sec.services.tag', 'السطر العلوي'],
        ['sec.services.h2', 'عنوان القسم', true],
        ['sec.services.desc', 'وصف القسم', true],
      ],
    },
    {
      id: 'gallery',
      title: 'قسم معرض الصور',
      hint: 'العنوان فقط — الصور تُدار من «معرض الصور»',
      fields: [
        ['sec.gallery.tag', 'السطر العلوي'],
        ['sec.gallery.h2', 'عنوان القسم', true],
        ['sec.gallery.desc', 'وصف القسم', true],
      ],
    },
    {
      id: 'why',
      title: 'لماذا نحن',
      hint: 'ست بطاقات',
      fields: [
        ['sec.why.tag', 'السطر العلوي'],
        ['sec.why.h2', 'عنوان القسم', true],
        ['sec.why.desc', 'وصف القسم', true],
        ...range(6).flatMap<FieldSpec>((n) => [
          [`why.${pad(n)}.title`, `الميزة ${n} — العنوان`],
          [`why.${pad(n)}.desc`, `الميزة ${n} — الشرح`, true],
        ]),
      ],
    },
    {
      id: 'testimonials',
      title: 'قسم آراء العملاء',
      hint: 'العنوان فقط — الآراء نفسها تُدار من «آراء العملاء»',
      fields: [
        ['sec.testi.tag', 'السطر العلوي'],
        ['sec.testi.h2', 'عنوان القسم', true],
        ['sec.testi.desc', 'وصف القسم', true],
      ],
    },
    {
      id: 'faq',
      title: 'الأسئلة الشائعة',
      hint: 'خمسة أسئلة',
      fields: [
        ['sec.faq.tag', 'السطر العلوي'],
        ['sec.faq.h2', 'عنوان القسم', true],
        ['sec.faq.desc', 'وصف القسم', true],
        ...range(5).flatMap<FieldSpec>((n) => [
          [`faq.${n}.q`, `السؤال ${n}`],
          [`faq.${n}.a`, `الإجابة ${n}`, true],
        ]),
      ],
    },
    {
      id: 'contact',
      title: 'قسم التواصل',
      hint: 'بطاقة البيانات ونموذج الحجز',
      fields: [
        ['sec.contact.tag', 'السطر العلوي'],
        ['sec.contact.h2', 'عنوان القسم', true],
        ['sec.contact.desc', 'وصف القسم', true],
        ['contact.title', 'عنوان بطاقة التواصل', true],
        ['contact.subtitle', 'وصف بطاقة التواصل', true],
        ['contact.phone.lbl', 'تسمية الهاتف'],
        ['contact.wa.lbl', 'تسمية الواتساب'],
        ['contact.wa.btn', 'نص زر الواتساب'],
        ['contact.location.lbl', 'تسمية الموقع'],
        ['contact.location.val', 'العنوان المكتوب'],
        ['contact.hours.lbl', 'تسمية ساعات العمل'],
        ['contact.hours.val', 'ساعات العمل المكتوبة'],
      ],
    },
    {
      id: 'form',
      title: 'نموذج الحجز',
      hint: 'تسميات حقول النموذج',
      fields: [
        ['form.name.label', 'تسمية الاسم'],
        ['form.phone.label', 'تسمية الجوال'],
        ['form.service.label', 'تسمية الخدمة'],
        ['form.car.label', 'تسمية السيارة'],
        ['form.notes.label', 'تسمية الملاحظات'],
        ['form.submit', 'نص زر الإرسال'],
      ],
    },
    {
      id: 'shared',
      title: 'نصوص مشتركة',
      hint: 'تظهر في كل صفحات الموقع — شريط التنقّل والتذييل والأزرار',
      fields: [
        ['nav.services', 'قائمة — الخدمات'],
        ['nav.gallery', 'قائمة — معرض الصور'],
        ['nav.contact', 'قائمة — تواصل معنا'],
        ['nav.testimonials', 'قائمة — آراء العملاء'],
        ['nav.why', 'قائمة — لماذا نحن'],
        ['nav.terms', 'قائمة — البنود والشروط'],
        ['nav.cta', 'زر القائمة الرئيسي'],
        ['footer.copy', 'سطر الحقوق'],
        ['footer.wa', 'تذييل — واتساب'],
        ['footer.terms', 'تذييل — الشروط'],
        ['footer.warranty', 'تذييل — سياسة الضمان'],
        ['footer.instagram', 'تذييل — انستجرام'],
        ['footer.home', 'تذييل — الرئيسية'],
        ['svc.btn.book', 'زر «احجز موعدك»'],
        ['svc.btn.wa', 'زر «واتساب»'],
        ['svc.btn.wa2', 'زر «راسلنا على واتساب»'],
        ['svc.btn.contact', 'زر «صفحة التواصل»'],
        ['svc.cta.desc', 'وصف دعوة الحجز في صفحات الخدمة', true],
      ],
    },
  ];
}

/** كل مفاتيح الصفحة الرئيسية بالترتيب الذي تظهر به */
export function homeContentKeys(): string[] {
  return homeGroupSpecs().flatMap((g) => g.fields.map(([suffix]) => suffix));
}

/** يقرأ محتوى الصفحة الرئيسية مجمّعاً في أقسام جاهزة للتحرير */
export async function getHomeContent(): Promise<ContentGroup[]> {
  const specs = homeGroupSpecs();
  const keys = specs.flatMap((g) => g.fields.map(([suffix]) => suffix));

  const rows = await db.translation.findMany({
    where: { key: { in: keys } },
    select: { key: true, ar: true, en: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return specs
    .map((g) => ({
      id: g.id,
      title: g.title,
      hint: g.hint,
      fields: g.fields
        .filter(([key]) => byKey.has(key))
        .map(([key, label, long]) => {
          const row = byKey.get(key)!;
          return { key, label, long: long ?? false, ar: row.ar, en: row.en ?? '' };
        }),
    }))
    .filter((g) => g.fields.length > 0);
}
