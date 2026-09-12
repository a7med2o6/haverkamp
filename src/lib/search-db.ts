import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { digitsOnly, normalizePlate } from '@/lib/search';

/**
 * معرّفات السيارات التي تطابق لوحتها ما كتبه الموظف.
 *
 * اللوحة تُخزَّن كما أُدخلت — «10-83538» بشرطة، و«10 83538» بمسافة، وبلا
 * فاصل أحياناً — فتوحيد المُدخَل وحده لا يكفي: «1083538» لا يحتويها
 * «10-83538» نصّاً. ولا بدّ من توحيد المخزَّن معه، وPrisma لا تُدخل دالةً
 * في contains، فيُوحَّد الطرفان في SQL وتُعاد المعرّفات لتُركَّب في
 * استعلام Prisma كبقيّة الشروط — فتبقى الصفحة باستعلامٍ واحد مُرقَّم.
 */
export async function vehicleIdsByPlate(input: string, limit = 200): Promise<string[]> {
  // ما يُترك للـLIKE حروفٌ وأرقام فقط، فلا يصير «%» من المُدخَل حرفاً عامّاً
  const term = normalizePlate(input).replace(/[^A-Z0-9]/g, '');
  if (!term) return [];

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM vehicles
    WHERE regexp_replace(upper(coalesce("plateNo", '')), '[^A-Z0-9]', '', 'g')
          LIKE '%' || ${term} || '%'
    LIMIT ${limit}`;

  return rows.map((row) => row.id);
}

/*
  الهاتف يُحفظ كما كتبه الموظف: «65811402» مجرّداً، و«+965 6581 1402»
  بمفتاحه ومسافاته، و«0096565811402» بصفريه. وتُعرض كلّها صورةً واحدة،
  فيكتب الباحث ما يرى ولا يجد ما خُزّن — وcontains مطابقةُ نصٍّ لا رقم.

  فيُردّ المخزَّن إلى صورته المعياريّة في SQL كما يردّه normalizePhoneDigits
  في المتصفّح وبالترتيب نفسه: تُجرَّد الأرقام، ثم يسقط الصفران الدوليّان،
  ثم يُلحق مفتاح الكويت بالثماني المحليّة. ويُبحث فيه عن أرقام المُدخَل
  وحدها، فيجد الكاملَ والجزءَ معاً: «+965 6581 1402» و«6581 1402»
  و«1402» ثلاثتها تجد «65811402».

  ولا يُطبَّع عمودٌ في الجدول: التطبيع في القراءة لا يحتاج هجرةً ولا
  يفرض مزامنةً على كل مسار كتابة، وأعداد فرعٍ واحد لا تبلغ ما يوجب فهرساً.
*/
const NORMALIZED = (col: string) => Prisma.sql`
  CASE
    WHEN left(regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g'), 2) = '00'
      THEN CASE
        WHEN length(substr(regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g'), 3)) = 8
          THEN '965' || substr(regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g'), 3)
        ELSE substr(regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g'), 3)
      END
    WHEN length(regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g')) = 8
      THEN '965' || regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g')
    ELSE regexp_replace(COALESCE(${Prisma.raw(col)}, ''), '\D', '', 'g')
  END`;

/*
  المُدخَل يُعامَل كما يُعامَل المخزَّن: صفرا الاتّصال الدوليّ يسقطان منه
  أيضاً، وإلا لبحثنا عن «0096565811402» في «96565811402» فلم نجده. ولا
  يُلحَق به مفتاحٌ: «1402» جزءٌ يُطلب كما هو، وإلحاق المفتاح يُبطل الجزئيّ.
*/
function phoneTerm(input: string): string {
  return digitsOnly(input).replace(/^00/, '');
}

/** معرّفات العملاء الذين يطابق هاتفهم — الحاليّ أو البديل أو المستبدَل — المُدخَل */
export async function customerIdsByPhone(input: string, limit = 200): Promise<string[]> {
  const term = phoneTerm(input);
  if (!term) return [];

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM customers
    WHERE ${NORMALIZED('phone')} LIKE '%' || ${term} || '%'
       OR ${NORMALIZED('"altPhone"')} LIKE '%' || ${term} || '%'
    UNION
    SELECT "customerId" AS id FROM customer_phones
    WHERE ${NORMALIZED('phone')} LIKE '%' || ${term} || '%'
    LIMIT ${limit}`;

  return rows.map((row) => row.id);
}

/** معرّفات الحجوزات التي كُتب فيها هاتف ضيفٍ مطابق — قبل أن يصير له ملفّ */
export async function bookingIdsByGuestPhone(input: string, limit = 200): Promise<string[]> {
  const term = phoneTerm(input);
  if (!term) return [];

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM bookings
    WHERE ${NORMALIZED('"guestPhone"')} LIKE '%' || ${term} || '%'
    LIMIT ${limit}`;

  return rows.map((row) => row.id);
}

/** معرّفات المورّدين الذين يطابق هاتفهم المُدخَل */
export async function supplierIdsByPhone(input: string, limit = 200): Promise<string[]> {
  const term = phoneTerm(input);
  if (!term) return [];

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM suppliers
    WHERE ${NORMALIZED('phone')} LIKE '%' || ${term} || '%'
    LIMIT ${limit}`;

  return rows.map((row) => row.id);
}
