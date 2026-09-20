/**
 * حقول معايرة هوامش ورق الشركة — تُنشأ ولا تُحدَّث.
 * التشغيل:  npm run db:settings:letterhead
 *
 * الطباعة تعمل بالهوامش الافتراضية بلا هذه الصفوف، لكنها لا تظهر في
 * «إعدادات الموقع» حتى تُنشأ. ولأن كل طابعة تنحرف مليمتراً أو اثنين،
 * تُعايَر بعد طباعة تجريبية — ولا يمحو هذا السكربت معايرةً سابقة.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** مقيسةٌ من إطار الورقة: جانباه على 10مم، ويبدأ تحت الشعار على 35.5مم */
const SETTINGS = [
  { key: 'pos.letterhead.top', value: 40, label: 'الهامش العلوي' },
  { key: 'pos.letterhead.bottom', value: 20, label: 'الهامش السفلي' },
  { key: 'pos.letterhead.left', value: 16, label: 'الهامش الأيسر' },
  { key: 'pos.letterhead.right', value: 16, label: 'الهامش الأيمن' },
];

async function main() {
  let created = 0;
  for (const s of SETTINGS) {
    const existing = await db.siteSetting.findUnique({ where: { key: s.key } });
    if (existing) {
      console.log(`· ${s.label}: موجود (${JSON.stringify(existing.value)}مم) — لم يُمسّ`);
      continue;
    }
    await db.siteSetting.create({
      data: { key: s.key, value: s.value as never, group: 'pos' },
    });
    console.log(`✔ ${s.label}: ${s.value}مم`);
    created++;
  }
  console.log(
    created > 0
      ? `\nأُنشئ ${created} حقلاً. تجدها في «إعدادات الموقع ← نقطة البيع».`
      : '\nالحقول الأربعة موجودة — لا جديد.'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
