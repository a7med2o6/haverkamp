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

/** يختار مخطّط الأقسام حسب نوع الصفحة */
function specsFor(slug: string): { prefix: string; specs: GroupSpec[] } | null {
  if (MIGRATED_SERVICES[slug]) {
    return { prefix: MIGRATED_SERVICES[slug].prefix, specs: groupSpecs(slug) };
  }
  if (MIGRATED_BRANDS[slug]) {
    return { prefix: MIGRATED_BRANDS[slug].prefix, specs: brandGroupSpecs(slug) };
  }
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
