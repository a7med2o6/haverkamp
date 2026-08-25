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
  nationality: string;
  phone: string;
  sponsor: string;
  residencyExpiry: string; // YYYY-MM-DD
  passport: string;
  passportExpiry: string;
  position: string;
  hireDate: string; // YYYY-MM-DD
  salary: number;
  bankAccount: string;
  bankIban: string;
};

const ROWS: Row[] = [
  ['فيجاي كومار ريباري ريباري', 'VIJAY KUMAR NARAYANAL REBARI', 'فيجي', '283031517021', 'هندي', '67619942', 'هافركامب', '2027-03-01', 'S2304139', '2028-04-26', 'غسال سيارات', '2022-01-11', 100, '', ''],
  ['بابجان شيك ارشاد شيك', 'BABJAN SHAIK ARSHAD SHAIK', 'عثمان', '289010190872', 'هندي', '', 'هافركامب', '2027-03-01', 'P8829677', '2027-03-27', 'غسال سيارات', '2018-05-28', 120, '', ''],
  ['افسرول اسلام ماينول حق لاسكار لاسكار', 'AFSARUL ISLAM MINUL HOQUE LASKAR LASKAR', 'افسرول', '295040306013', 'هندي', '94430696', 'هافركامب', '2027-07-24', 'W4960394', '2032-10-10', 'غسال سيارات', '2023-09-23', 120, '', ''],
  ['ابراث على كاليجار جعفر كاليجار', 'IBRATH ALI GAFFAR KALIGAR', 'ابراث', '289010149925', 'هندي', '95586730', 'هافركامب', '2026-09-01', 'B6042732', '2033-12-26', 'غسال سيارات', '2016-01-12', 120, '', ''],
  ['كابيبو رحمان جاهور', 'KABIBU RAHUMAN JAHUBAR', 'حبيب', '288010609616', 'هندي', '60344121', 'هافركامب', '2026-09-01', 'S9937605', '2029-03-24', 'غسال سيارات', '2023-05-07', 120, '', ''],
  ['داستاجير على موسي', 'DASTAGIR ALIMUSA', 'محمد', '285010192124', 'هندي', '66272648', 'هافركامب', '2026-09-02', 'Y3681370', '2034-08-24', 'غسال سيارات', '2019-01-30', 120, '', ''],
  ['سماد حسين اينولالحق مازومادير', 'SAMAD HUSSAIN AINUL HAQUE MAZUMDER', 'سامد', '299122803089', 'هندي', '95511769', 'هافركامب', '2027-03-16', 'V7239168', '2032-03-10', 'غسال سيارات', '2024-02-01', 100, '', ''],
  ['باربيز حسين تيبور رحمن', 'PARBEZ HUSSAIN TAIBUR BARABHUIYA', 'حسين', '301080202399', 'هندي', '99167238', 'هافركامب', '2027-03-02', 'U7258370', '2031-06-22', 'غسال سيارات', '2023-09-23', 120, '631140000318', 'KW56KWIB0000000000631140000318'],
  ['احمد محمد احمد نوفل', 'AHMED MOHAMMED NOUFAL', 'احمد', '289030805467', 'مصري', '65811402', 'هافركامب', '2027-03-02', 'A36958742', '2031-02-28', 'مدير مشتريات', '2022-08-01', 800, '', ''],
  ['امرول اسلام تاميج دين لاسكار لاسكار', 'AMRUL ISLAM TAMIJ UDDIN LASKAR LASKAR', 'اسلام', '301101102048', 'هندي', '99803501', 'هافركامب', '2027-03-01', 'W4947717', '2032-10-02', 'غسال سيارات', '2023-08-28', 100, '631140000334', 'KW12KWIB0000000000631140000334'],
  ['سعيد العلوم لاسكار منولهو كسكار', 'SAIDUL ALOM MAMUL HAQUE LASKAR', 'سيد', '294081403317', 'هندي', '50464187', 'هافركامب', '2027-03-01', 'R8792787', '2028-05-16', 'عامل تجليخ وتلميع', '2018-11-18', 120, '631140000407', 'KW78KWIB0000000000631140000407'],
  ['شاهيد ماليبولا مادراساب ماهبوب', 'SHAHID L M BASHA', 'بكر', '288010214809', 'هندي', '9809679', 'هافركامب', '2027-03-01', 'R9318494', '2028-02-08', 'غسال سيارات', '2018-05-28', 120, '631140000342', 'KW87KWIB0000000000631140000342'],
  ['بيتر ممدوح ناجي', 'PETER MAMDOUH NAGY', 'بيتر', '293090106598', 'مصري', '65691849', 'هافركامب', '2027-04-08', 'A32761831', '2030-01-11', 'مدير مبيعات', '2020-02-01', 800, '', ''],
  ['معروف علوم لاسكار سيراجو لاسلاملا', 'MARUF ALOM LASKAR SIRAJUL ISLAM', 'معروف', '293050405235', 'هندي', '99578237', 'هافركامب', '2027-03-01', 'C1403002', '2034-10-09', 'عامل تجليخ وتلميع', '2018-08-16', 120, '631140000300', 'KW57KWIB0000000000631140000300'],
  ['بحر اودين لاسكار', 'BAHAR UDDIN LASKAR', 'بحر', '297051403109', 'هندي', '50824169', 'هافركامب', '2027-03-01', 'S3242105', '2029-01-23', 'غسال سيارات', '2022-03-03', 120, '631140000326', 'KW34KWIB0000000000631140000326'],
  ['محمد ابوبكر عبدالراشد عبدالراشد', 'MOHAMED ABUBACKER ABDULRASHEED ABDUL RASHEED', 'عمر', '280042506834', 'هندي', '', 'أبو ثامر', '2027-09-14', 'C2718808', '2034-09-09', 'فراش', '2025-01-16', 120, '', ''],
  ['هاليم مولا خيديرمولا', 'HALEM MOLLA HIDIR MOLLA', 'عاليم', '284061017831', 'بنغلاديشي', '66578025', 'هافركامب', '2026-09-01', 'EL0798561', '2028-07-19', 'صباغ', '2024-09-01', 120, '', ''],
  ['شانموجام سيفاسوبرا مانيان', 'SHANMUGAM SIVASUBRAMANIAN', 'سيفا', '273053101677', 'هندي', '60080544', 'ابوذعار', '2027-09-21', 'W0771162', '2032-08-16', 'سائق', '2024-09-21', 120, '', ''],
  ['محمد خالد', 'MOHAMMED KHALID', 'خالد', '295020110515', 'هندي', '', 'ابوذعار', '2027-02-03', 'P6890909', '2027-03-28', 'حداد', '2025-10-13', 120, '', ''],
].map(([ar, en, nickname, civilId, nationality, phone, sponsor, residencyExpiry, passport, passportExpiry, position, hireDate, salary, bankAccount, bankIban]) => ({
  ar, en, nickname, civilId, nationality, phone, sponsor, residencyExpiry, passport,
  passportExpiry, position, hireDate, salary, bankAccount, bankIban,
} as Row));

/**
 * تاريخ الميلاد من البطاقة المدنية الكويتية: C YY MM DD NNNN X
 * حيث C=2 لمواليد القرن العشرين و3 للألفية. البطاقة هي المرجع لأن
 * الكشف كتب تاريخاً واحداً بصيغة شهر/يوم بينما بقيته يوم/شهر.
 */
function birthDateFromCivilId(civilId: string): Date | null {
  if (!/^[23]\d{11}$/.test(civilId)) return null;
  const year = (civilId[0] === '2' ? 1900 : 2000) + Number(civilId.slice(1, 3));
  const month = Number(civilId.slice(3, 5));
  const dayOfMonth = Number(civilId.slice(5, 7));
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31) return null;
  return new Date(Date.UTC(year, month - 1, dayOfMonth));
}

const NO_PHONE_NOTE = '⚠ رقم الهاتف غير مسجّل';

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
      nationality: r.nationality,
      sponsor: r.sponsor,
      phone: r.phone,
      birthDate: birthDateFromCivilId(r.civilId),
      hireDate: day(r.hireDate),
      baseSalary: r.salary,
      bankName: 'KIB',
      bankAccount: r.bankAccount || null,
      bankIban: r.bankIban || null,
      notes: r.phone ? null : NO_PHONE_NOTE,
    };

    // الحالة تُضبط عند الإنشاء فقط — من هو في إجازة اليوم لا يُعاد تنشيطه
    const employee = existing
      ? await db.employee.update({ where: { id: existing.id }, data })
      : await db.employee.create({
          data: {
            ...data,
            status: 'ACTIVE' as const,
            code: `HK-E-${String(i + 1).padStart(3, '0')}`,
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
