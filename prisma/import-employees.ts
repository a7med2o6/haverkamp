/**
 * استيراد الموظفين من كشف الإقامات.
 * التشغيل:  npm run db:import:employees
 *
 * آمن للتكرار — المفتاح هو الرقم المدني، فإعادة التشغيل تحدّث ولا تكرّر.
 * التليفون وتاريخ التعيين والراتب غير موجودة في الكشف — تُترك فارغة
 * وتُذكر في ملاحظات الموظف حتى لا تمرّ صامتة إلى مسيّر الرواتب.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Row = {
  ar: string;
  en: string;
  nickname: string;
  civilId: string;
  sponsor: string;
  residencyExpiry: string; // YYYY-MM-DD
  passport: string;
  passportExpiry: string;
  position: string;
};

const ROWS: Row[] = [
  ['فيجاي كومار ريباري ريباري', 'VIJAY KUMAR NARAYANAL REBARI', 'فيجي', '283031517021', 'هافركامب', '2027-03-01', 'S2304139', '2028-04-26', 'غسال سيارات'],
  ['بابجان شيك ارشاد شيك', 'BABJAN SHAIK ARSHAD SHAIK', 'عثمان', '289010190872', 'هافركامب', '2027-03-01', 'P8829677', '2027-03-27', 'غسال سيارات'],
  ['افسرول اسلام ماينول حق لاسكار لاسكار', 'AFSARUL ISLAM MINUL HOQUE LASKAR LASKAR', 'افسرول', '295040306013', 'هافركامب', '2027-07-24', 'W4960394', '2032-10-10', 'غسال سيارات'],
  ['ابراث على كاليجار جعفر كاليجار', 'IBRATH ALI GAFFAR KALIGAR', 'ابراث', '289010149925', 'هافركامب', '2026-09-01', 'B6042732', '2033-12-26', 'غسال سيارات'],
  ['كابيبو رحمان جاهور', 'KABIBU RAHUMAN JAHUBAR', 'حبيب', '288010609616', 'هافركامب', '2026-09-01', 'S9937605', '2029-03-24', 'غسال سيارات'],
  ['داستاجير على موسي', 'DASTAGIR ALIMUSA', 'محمد', '285010192124', 'هافركامب', '2026-09-02', 'Y3681370', '2034-08-24', 'غسال سيارات'],
  ['سماد حسين اينولالحق مازومادير', 'SAMAD HUSSAIN AINUL HAQUE MAZUMDER', 'سامد', '299122803089', 'هافركامب', '2027-03-16', 'V7239168', '2032-03-10', 'غسال سيارات'],
  ['باربيز حسين تيبور رحمن', 'PARBEZ HUSSAIN TAIBUR BARABHUIYA', 'حسين', '301080202399', 'هافركامب', '2027-03-02', 'U7258370', '2031-06-22', 'غسال سيارات'],
  ['احمد محمد احمد نوفل', 'AHMED MOHAMMED NOUFAL', 'احمد', '289030805467', 'هافركامب', '2027-03-02', 'A36958742', '2031-02-28', 'مدير مشتريات'],
  ['امرول اسلام تاميج دين لاسكار لاسكار', 'AMRUL ISLAM TAMIJ UDDIN LASKAR LASKAR', 'اسلام', '301101102048', 'هافركامب', '2027-03-01', 'W4947717', '2032-10-02', 'غسال سيارات'],
  ['سعيد العلوم لاسكار منولهو كسكار', 'SAIDUL ALOM MAMUL HAQUE LASKAR', 'سيد', '294081403317', 'هافركامب', '2027-03-01', 'R8792787', '2028-05-16', 'عامل تجليخ وتلميع'],
  ['شاهيد ماليبولا مادراساب ماهبوب', 'SHAHID L M BASHA', 'بكر', '288010214809', 'هافركامب', '2027-03-01', 'R9318494', '2028-02-08', 'غسال سيارات'],
  ['بيتر ممدوح ناجي', 'PETER MAMDOUH NAGY', 'بيتر', '293090106598', 'هافركامب', '2027-04-08', 'A32761831', '2030-01-11', 'مدير مبيعات'],
  ['معروف علوم لاسكار سيراجو لاسلاملا', 'MARUF ALOM LASKAR SIRAJUL ISLAM', 'معروف', '293050405235', 'هافركامب', '2027-03-01', 'C1403002', '2034-10-09', 'عامل تجليخ وتلميع'],
  ['بحر اودين لاسكار', 'BAHAR UDDIN LASKAR', 'بحر', '297051403109', 'هافركامب', '2027-03-01', 'S3242105', '2029-01-23', 'غسال سيارات'],
  ['محمد ابوبكر عبدالراشد عبدالراشد', 'MOHAMED ABUBACKER ABDULRASHEED ABDUL RASHEED', 'عمر', '280042506834', 'أبو ثامر', '2027-09-14', 'C2718808', '2034-09-09', 'فراش'],
  ['هاليم مولا خيديرمولا', 'HALEM MOLLA HIDIR MOLLA', 'عاليم', '284061017831', 'هافركامب', '2026-09-01', 'EL0798561', '2028-07-19', 'صباغ'],
  ['شانموجام سيفاسوبرا مانيان', 'SHANMUGAM SIVASUBRAMANIAN', 'سيفا', '273053101677', 'ابوذعار', '2027-09-21', 'W0771162', '2032-08-16', 'سائق'],
  ['محمد خالد', 'MOHAMMED KHALID', 'خالد', '295020110515', 'ابوذعار', '2027-02-03', 'P6890909', '2027-03-28', 'حداد'],
].map(([ar, en, nickname, civilId, sponsor, residencyExpiry, passport, passportExpiry, position]) => ({
  ar, en, nickname, civilId, sponsor, residencyExpiry, passport, passportExpiry, position,
}));

const MISSING_NOTE =
  '⚠ مستوردة من كشف الإقامات — التليفون وتاريخ التعيين والراتب الأساسي لم تُدخل بعد';

/** منتصف ليل UTC — الوثائق تواريخ بلا وقت */
function day(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  const purge = process.argv.includes('--purge-demo');

  /**
   * --purge-demo يحذف كل موظف قائم قبل الاستيراد، ومعه حضوره وقسائمه
   * وسلفه وإجازاته بالتتابع. للاستبدال الكامل مرة واحدة لا للتشغيل الدوري:
   * حذفٌ بالرقم المدني وحده كان سينجّي صفاً تجريبياً يحمل رقم عامل حقيقي
   * فيحوّله إليه ويورّثه سجلاته.
   */
  if (purge) {
    const doomed = await db.employee.findMany({
      select: { id: true, code: true, fullName: true },
    });
    for (const e of doomed) console.log(`✖ حذف ${e.code} — ${e.fullName}`);
    if (doomed.length > 0) {
      await db.employee.deleteMany({ where: { id: { in: doomed.map((e) => e.id) } } });
    }
  }

  let created = 0;
  let updated = 0;

  for (const [i, r] of ROWS.entries()) {
    const existing = await db.employee.findFirst({
      where: { civilId: r.civilId },
      select: { id: true },
    });

    const data = {
      fullName: r.ar,
      fullNameEn: r.en,
      nickname: r.nickname,
      position: r.position,
      civilId: r.civilId,
      sponsor: r.sponsor,
      status: 'ACTIVE' as const,
    };

    const employee = existing
      ? await db.employee.update({ where: { id: existing.id }, data })
      : await db.employee.create({
          data: {
            ...data,
            code: `HK-E-${String(i + 1).padStart(3, '0')}`,
            phone: '',
            hireDate: new Date(),
            baseSalary: 0,
            notes: MISSING_NOTE,
          },
        });

    existing ? updated++ : created++;

    // الوثائق: الإقامة والجواز والبطاقة — تغذّي تنبيهات انتهاء المستندات
    const docs = [
      { type: 'RESIDENCY' as const, number: null as string | null, expiryDate: day(r.residencyExpiry) },
      { type: 'PASSPORT' as const, number: r.passport, expiryDate: day(r.passportExpiry) },
      { type: 'CIVIL_ID' as const, number: r.civilId, expiryDate: null },
    ];

    for (const doc of docs) {
      const found = await db.employeeDocument.findFirst({
        where: { employeeId: employee.id, type: doc.type },
        select: { id: true },
      });
      if (found) {
        await db.employeeDocument.update({ where: { id: found.id }, data: doc });
      } else {
        await db.employeeDocument.create({ data: { ...doc, employeeId: employee.id } });
      }
    }
  }

  console.log(`\n✔ جديد ${created} · محدَّث ${updated} · الإجمالي ${await db.employee.count()}`);
  await db.$disconnect();
}

main();
