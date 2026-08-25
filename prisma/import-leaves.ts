/**
 * استيراد سجل إجازات الموظفين — المطابقة بالرقم المدني.
 * التشغيل:  npm run db:import:leaves
 *
 * آمن للتكرار: المفتاح هو (الموظف + تاريخ البداية) فتُحدَّث ولا تتكرر.
 * كلها ANNUAL بقرار الإدارة، وحالتها APPROVED لأنها وقعت فعلاً.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** [الرقم المدني, من, إلى, السبب] */
const ROWS: Array<[string, string, string, string]> = [
  ['289030805467', '2024-02-27', '2024-03-06', 'تجديد الجواز'],
  ['293090106598', '2023-05-28', '2023-07-16', ''],
  ['293090106598', '2024-01-05', '2024-02-15', ''],
  ['285010192124', '2021-09-17', '2021-12-08', 'سنوية'],
  ['285010192124', '2024-06-06', '2024-08-14', 'تغيير من خادم إلى أهلي'],
  ['297051403109', '2024-05-07', '2024-06-21', 'سنوية'],
  ['288010214809', '2024-01-06', '2024-04-17', 'سنوية'],
  ['288010609616', '2024-05-17', '2024-07-21', 'سنوية'],
  ['293050405235', '2021-12-08', '2022-01-21', 'سنوية'],
  ['293050405235', '2023-01-03', '2023-05-10', 'سنوية'],
  ['293050405235', '2024-09-15', '2024-11-20', 'سنوية'],
  ['289010149925', '2018-12-05', '2019-02-28', 'سنوية'],
  ['289010149925', '2021-04-13', '2021-10-20', ''],
  ['289010149925', '2023-09-03', '2023-11-23', ''],
  ['289010149925', '2024-12-27', '2025-02-25', ''],
  ['294081403317', '2022-08-11', '2022-11-08', ''],
  ['294081403317', '2023-12-02', '2023-12-26', ''],
  ['294081403317', '2024-11-23', '2024-12-22', ''],
  ['283031517021', '2023-08-28', '2023-11-01', 'تغيير الفيزا'],
  ['284061017831', '2025-07-07', '2025-08-14', ''],
  ['280042506834', '2025-05-16', '2025-07-19', ''],
  ['273053101677', '2026-01-03', '2026-01-28', 'وفاة أخيه'],
  ['293050405235', '2026-05-24', '2026-09-06', ''],
  ['295040306013', '2026-07-27', '2026-10-10', 'زواج'],
  ['293090106598', '2026-07-11', '2026-07-20', ''],
];

/** fromDate/toDate من نوع @db.Date — نتعامل بها UTC حتى لا تنزاح يوماً */
function day(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  const employees = await db.employee.findMany({
    where: { civilId: { not: null } },
    select: { id: true, civilId: true, nickname: true, fullName: true },
  });
  const byCivilId = new Map(employees.map((e) => [e.civilId!, e]));

  let created = 0;
  let updated = 0;
  const missing: string[] = [];

  for (const [civilId, from, to, reason] of ROWS) {
    const employee = byCivilId.get(civilId);
    if (!employee) {
      missing.push(civilId);
      continue;
    }

    const fromDate = day(from);
    const toDate = day(to);
    // المدة شاملة الطرفين — نفس حساب النظام عند تسجيل إجازة
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

    const data = {
      employeeId: employee.id,
      type: 'ANNUAL' as const,
      fromDate,
      toDate,
      days,
      reason: reason || null,
      status: 'APPROVED' as const,
      decidedAt: fromDate,
    };

    const existing = await db.leaveRequest.findFirst({
      where: { employeeId: employee.id, fromDate },
      select: { id: true },
    });

    if (existing) {
      await db.leaveRequest.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.leaveRequest.create({ data });
      created++;
    }
  }

  // من إجازته تشمل اليوم حالته ON_LEAVE — والمسيّر يشمل الحالتين فلا يتأثر صرفه
  const today = new Date();
  const onLeave = await db.leaveRequest.findMany({
    where: { status: 'APPROVED', fromDate: { lte: today }, toDate: { gte: today } },
    select: { employeeId: true },
  });

  if (onLeave.length > 0) {
    await db.employee.updateMany({
      where: { id: { in: onLeave.map((l) => l.employeeId) }, status: 'ACTIVE' },
      data: { status: 'ON_LEAVE' },
    });
  }

  console.log(`✔ جديد ${created} · محدَّث ${updated} · في إجازة اليوم ${onLeave.length}`);
  if (missing.length) console.warn(`⚠ أرقام مدنية بلا موظف: ${missing.join(', ')}`);

  await db.$disconnect();
}

main();
