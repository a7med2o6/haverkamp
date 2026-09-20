/**
 * رموز النوع في عمود «النوع» بالفاتورة المطبوعة.
 *
 * الورقة ضيّقة والاسم الكامل يزاحم الصنف — «حماية هافركامب الألمانية» في
 * عمودٍ لا يتّسع. والرمز يقرؤه الفنّي والعميل معاً، وهو ما اعتاده الفرع.
 *
 * ماركات حماية البدي خدماتٌ لها slug، فتُربط به لا باسمها المكتوب: تغيير
 * اسم الخدمة من اللوحة لا يُسقط رمزها. أمّا العازل وحماية الجام فماركتهما
 * نصٌّ يُختار من قائمة، فتُطابَق بنصّها.
 */

/** ماركات حماية البدي — بـslug خدمتها */
const BY_SLUG: Record<string, string> = {
  haverkamp: 'H.K.T',
  clif: 'C.D.T',
  iron: 'I.S',
  xpel: 'X.P.T',
  hexis: 'H.E.T',
};

/** ماركات العازل الحراري — نصّاً */
const TINT: Record<string, string> = {
  'صن تك': 'S.T',
  هافركامب: 'H.K',
  'رويال شيلد': 'R',
};

/** ماركات حماية الجام — نصّاً. ASWF وClearPlex تُكتبان كما هما */
const GLASS: Record<string, string> = {
  'رويال شيلد': 'R',
  ASWF: 'ASWF',
  ClearPlex: 'ClearPlex',
};

/** ألف مقصورة وهمزات مختلفة في «أيرون» و«إكس» — فتُسوّى قبل المطابقة */
function normalize(text: string) {
  return text.trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
}

function lookup(table: Record<string, string>, brand: string) {
  const wanted = normalize(brand);
  const hit = Object.entries(table).find(([name]) => normalize(name) === wanted);
  return hit?.[1] ?? null;
}

/**
 * رمز البند من خدمته وماركته — وفارغ لما لا نوع له (الصبغ، التلبيس، البوليش).
 * `serviceSlug` slug خدمة الماركة إن كانت الماركة خدمةً، و`brand` نصّها.
 */
export function typeCodeOf({
  serviceSlug,
  brand,
  label,
}: {
  serviceSlug?: string | null;
  brand?: string | null;
  label?: string | null;
}): string | null {
  if (serviceSlug && BY_SLUG[serviceSlug]) return BY_SLUG[serviceSlug];
  if (!brand) return null;

  // «هافركامب» ماركةٌ للبدي وللعازل برمزين مختلفين — يفرّقهما اسم البند
  const isTint = (label ?? '').includes('عازل');
  return isTint ? lookup(TINT, brand) : (lookup(GLASS, brand) ?? lookup(TINT, brand));
}
