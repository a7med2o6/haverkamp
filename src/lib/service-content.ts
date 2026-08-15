import { db } from '@/lib/db';
import { MIGRATED_SERVICES } from '@/lib/site-data';

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
  ];

  // شريط الخامات يظهر أسفل الخطوات في الخدمات التي تعرّفه فقط
  if (config.materials?.length) {
    specs[1].fields.push(
      ...config.materials.map<FieldSpec>((name, i) => [`mat${i + 1}`, `الخامة «${name}» — الوصف`])
    );
  }

  return specs;
}

/** كل مفاتيح صفحة الخدمة بالترتيب الذي تظهر به */
export function serviceContentKeys(slug: string): string[] {
  const prefix = MIGRATED_SERVICES[slug]?.prefix;
  if (!prefix) return [];

  return groupSpecs(slug).flatMap((g) => g.fields.map(([suffix]) => `${prefix}.${suffix}`));
}

/** يقرأ محتوى صفحة الخدمة مجمّعاً في أقسام جاهزة للتحرير */
export async function getServiceContent(slug: string): Promise<ContentGroup[]> {
  const prefix = MIGRATED_SERVICES[slug]?.prefix;
  if (!prefix) return [];

  const specs = groupSpecs(slug);
  const keys = specs.flatMap((g) => g.fields.map(([suffix]) => `${prefix}.${suffix}`));

  const rows = await db.translation.findMany({
    where: { key: { in: keys } },
    select: { key: true, ar: true, en: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return specs.map((g) => ({
    id: g.id,
    title: g.title,
    hint: g.hint,
    fields: g.fields.map(([suffix, label, long]) => {
      const key = `${prefix}.${suffix}`;
      const row = byKey.get(key);
      return { key, label, long: long ?? false, ar: row?.ar ?? '', en: row?.en ?? '' };
    }),
  }));
}
