import { db } from '@/lib/db';
import { normalizePlate } from '@/lib/search';

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
