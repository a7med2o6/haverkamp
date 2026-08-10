/**
 * بيانات تجريبية للاختبار — لا تُشغّل على قاعدة الإنتاج.
 * التشغيل: npm run db:seed:demo
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function nextCode(key: string, prefix: string, pad = 4) {
  const c = await db.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(c.value).padStart(pad, '0')}`;
}

const EMPLOYEES = [
  { fullName: 'محمد سيد إبراهيم', position: 'فني تركيب أول', dept: 'ورشة الحماية', nationality: 'مصري', salary: 450, allowance: 50 },
  { fullName: 'راجيش كومار', position: 'فني تركيب', dept: 'ورشة الحماية', nationality: 'هندي', salary: 320, allowance: 30 },
  { fullName: 'أحمد خالد الرشيدي', position: 'مشرف الورشة', dept: 'ورشة الصبغ', nationality: 'كويتي', salary: 750, allowance: 100 },
  { fullName: 'سامي عبدالرحمن', position: 'فني عازل حراري', dept: 'العازل الحراري', nationality: 'سوري', salary: 380, allowance: 40 },
  { fullName: 'جوزيف سانتوس', position: 'فني غسيل وتلميع', dept: 'الغسيل والتلميع', nationality: 'فلبيني', salary: 260, allowance: 25 },
  { fullName: 'نورة الفهد', position: 'موظفة استقبال', dept: 'الاستقبال والمبيعات', nationality: 'كويتية', salary: 500, allowance: 60 },
  { fullName: 'عمر حسن', position: 'محاسب', dept: 'المحاسبة', nationality: 'أردني', salary: 600, allowance: 80 },
];

const PRODUCTS = [
  { nameAr: 'فيلم حماية هافركامب — لفة 1.52م', cat: 'أفلام حماية', cost: 180, price: 0, unit: 'متر', stock: 120, reorder: 30, type: 'GOOD' as const },
  { nameAr: 'فيلم كلايف ديزاين — لفة 1.52م', cat: 'أفلام حماية', cost: 150, price: 0, unit: 'متر', stock: 80, reorder: 25, type: 'GOOD' as const },
  { nameAr: 'عازل حراري أمريكي 70%', cat: 'عوازل حرارية', cost: 45, price: 0, unit: 'متر', stock: 60, reorder: 20, type: 'GOOD' as const },
  { nameAr: 'معجون بوليش ألماني 1كجم', cat: 'مواد تلميع', cost: 12, price: 18, unit: 'علبة', stock: 24, reorder: 10, type: 'GOOD' as const },
  { nameAr: 'عطر دكتور ماركوس', cat: 'عطور', cost: 2.5, price: 6, unit: 'قطعة', stock: 8, reorder: 15, type: 'GOOD' as const },
  { nameAr: 'ميدالية جلد فاخرة', cat: 'ميداليات', cost: 3, price: 8.5, unit: 'قطعة', stock: 40, reorder: 12, type: 'GOOD' as const },
  { nameAr: 'غسيل خارجي وداخلي', cat: null, cost: 0, price: 12, unit: 'خدمة', stock: 0, reorder: 0, type: 'SERVICE' as const },
  { nameAr: 'بوليش كامل', cat: null, cost: 0, price: 65, unit: 'خدمة', stock: 0, reorder: 0, type: 'SERVICE' as const },
  { nameAr: 'تظليل كامل — سيارة صالون', cat: null, cost: 0, price: 145, unit: 'خدمة', stock: 0, reorder: 0, type: 'SERVICE' as const },
];

const CUSTOMERS = [
  { name: 'فهد المطيري', phone: '+965 9900 1122', area: 'الجابرية', car: { make: 'مرسيدس', model: 'G63', year: 2023, plate: '11223' } },
  { name: 'بدر العنزي', phone: '+965 6677 8899', area: 'السالمية', car: { make: 'لكزس', model: 'LX600', year: 2024, plate: '44556' } },
  { name: 'سارة الخالدي', phone: '+965 5544 3322', area: 'الشويخ', car: { make: 'رينج روفر', model: 'Vogue', year: 2022, plate: '77889' } },
];

async function seedEmployees() {
  const departments = await db.department.findMany();
  const byName = new Map(departments.map((d) => [d.nameAr, d.id]));

  let created = 0;
  for (const e of EMPLOYEES) {
    const exists = await db.employee.findFirst({ where: { fullName: e.fullName } });
    if (exists) continue;

    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - Math.ceil(Math.random() * 6));

    const employee = await db.employee.create({
      data: {
        code: await nextCode('employee', 'HK-E', 3),
        fullName: e.fullName,
        position: e.position,
        departmentId: byName.get(e.dept) ?? null,
        phone: `+965 ${Math.floor(50000000 + Math.random() * 9999999)}`,
        nationality: e.nationality,
        hireDate,
        baseSalary: e.salary,
        allowance: e.allowance,
        status: 'ACTIVE',
      },
    });
    created++;

    // مستند إقامة — بعضها قارب على الانتهاء لاختبار التنبيهات
    if (e.nationality !== 'كويتي' && e.nationality !== 'كويتية') {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + Math.floor(Math.random() * 400) - 40);
      await db.employeeDocument.create({
        data: {
          employeeId: employee.id,
          type: 'RESIDENCY',
          number: String(Math.floor(280000000000 + Math.random() * 9999999999)),
          expiryDate: expiry,
        },
      });
    }
  }
  console.log(`  ✔ الموظفون: ${created} جديد`);
}

async function seedAttendance() {
  const employees = await db.employee.findMany({ where: { status: 'ACTIVE' } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  // آخر 14 يوماً
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 5) continue; // الجمعة عطلة

    for (const emp of employees) {
      const exists = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date } },
      });
      if (exists) continue;

      const roll = Math.random();
      if (roll < 0.05) {
        await db.attendance.create({ data: { employeeId: emp.id, date, status: 'ABSENT' } });
      } else {
        const lateMins = roll < 0.2 ? Math.floor(Math.random() * 45) + 16 : 0;
        const checkIn = new Date(date);
        checkIn.setHours(10, lateMins, 0, 0);
        const checkOut = new Date(date);
        checkOut.setHours(20, Math.floor(Math.random() * 40), 0, 0);
        const worked = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);

        await db.attendance.create({
          data: {
            employeeId: emp.id,
            date,
            checkIn,
            checkOut,
            lateMins,
            overtimeMins: Math.max(0, worked - 600),
            status: lateMins > 0 ? 'LATE' : 'PRESENT',
          },
        });
      }
      created++;
    }
  }
  console.log(`  ✔ سجلات الحضور: ${created}`);
}

async function seedProducts() {
  const categories = await db.productCategory.findMany();
  const byName = new Map(categories.map((c) => [c.nameAr, c.id]));

  let created = 0;
  for (const [i, p] of PRODUCTS.entries()) {
    const sku = `HK-P-${String(i + 1).padStart(4, '0')}`;
    const exists = await db.product.findUnique({ where: { sku } });
    if (exists) continue;

    await db.product.create({
      data: {
        sku,
        nameAr: p.nameAr,
        type: p.type,
        categoryId: p.cat ? (byName.get(p.cat) ?? null) : null,
        cost: p.cost,
        price: p.price || p.cost * 1.6,
        unit: p.unit,
        trackStock: p.type === 'GOOD',
        stockQty: p.stock,
        reorderLevel: p.reorder,
        showOnline: p.cat === 'عطور' || p.cat === 'ميداليات',
      },
    });
    created++;
  }
  console.log(`  ✔ المنتجات: ${created} جديد`);
}

async function seedCustomers() {
  let created = 0;
  for (const c of CUSTOMERS) {
    const exists = await db.customer.findFirst({ where: { phone: c.phone } });
    if (exists) continue;

    const customer = await db.customer.create({
      data: {
        code: await nextCode('customer', 'HK-C'),
        name: c.name,
        phone: c.phone,
        area: c.area,
        source: 'WEBSITE',
      },
    });

    await db.vehicle.create({
      data: {
        customerId: customer.id,
        make: c.car.make,
        model: c.car.model,
        year: c.car.year,
        plateNo: c.car.plate,
      },
    });
    created++;
  }
  console.log(`  ✔ العملاء: ${created} جديد`);
}

async function seedBookings() {
  const customers = await db.customer.findMany({ include: { vehicles: true }, take: 3 });
  const services = await db.service.findMany({ where: { showInNav: true }, take: 4 });
  if (customers.length === 0 || services.length === 0) return;

  const existing = await db.booking.count();
  if (existing > 0) {
    console.log('  · الحجوزات موجودة — تم التخطي');
    return;
  }

  let created = 0;
  for (const [i, c] of customers.entries()) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + i + 1);
    scheduledAt.setHours(11 + i, 0, 0, 0);

    await db.booking.create({
      data: {
        code: await nextCode('booking', 'HK-B'),
        customerId: c.id,
        vehicleId: c.vehicles[0]?.id ?? null,
        serviceId: services[i % services.length].id,
        scheduledAt,
        status: i === 0 ? 'CONFIRMED' : 'PENDING',
        source: 'WEBSITE',
      },
    });
    created++;
  }
  console.log(`  ✔ الحجوزات: ${created}`);
}

/** يُكمل بروفايل أول موظف ببيانات كاملة لمعاينة صفحة البروفايل */
async function enrichFirstProfile() {
  const e = await db.employee.findFirst({ where: { code: 'HK-E-001' } });
  if (!e) return;

  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

  await db.employee.update({
    where: { id: e.id },
    data: {
      fullNameEn: 'mohamed sayed ibrahim',
      position: 'غسال سيارات',
      sponsor: 'هافركامب',
      bankName: 'KIB',
      bankAccount: '0123456789',
      bankIban: 'KW81CBKU0000000000001234560101',
      civilId: '285010192124',
      birthDate: d('1985-03-14'),
      phone: '66272648',
    },
  });

  const docs = [
    { type: 'CIVIL_ID' as const, number: '285010192124', expiryDate: d('2026-09-02') },
    { type: 'PASSPORT' as const, number: 'A12345678', expiryDate: d('2034-08-24') },
    { type: 'WORK_PERMIT' as const, number: 'WP-9931', expiryDate: d('2026-09-02') },
  ];

  for (const doc of docs) {
    const existing = await db.employeeDocument.findFirst({
      where: { employeeId: e.id, type: doc.type },
    });
    if (existing) await db.employeeDocument.update({ where: { id: existing.id }, data: doc });
    else await db.employeeDocument.create({ data: { employeeId: e.id, ...doc } });
  }

  const leaves = [
    {
      fromDate: d('2021-09-17'),
      toDate: d('2021-12-08'),
      days: 83,
      type: 'ANNUAL' as const,
      reason: 'سنوية',
      status: 'APPROVED' as const,
    },
    {
      fromDate: d('2024-06-06'),
      toDate: d('2024-08-14'),
      days: 70,
      type: 'UNPAID' as const,
      reason: 'تغير من خادم الي اهلي',
      status: 'APPROVED' as const,
    },
  ];

  for (const l of leaves) {
    const existing = await db.leaveRequest.findFirst({
      where: { employeeId: e.id, fromDate: l.fromDate },
    });
    if (!existing) await db.leaveRequest.create({ data: { employeeId: e.id, ...l } });
  }

  console.log('  ✔ بروفايل كامل للموظف HK-E-001');
}

async function main() {
  console.log('▶ تعبئة بيانات تجريبية…');
  await seedEmployees();
  await seedAttendance();
  await seedProducts();
  await seedCustomers();
  await seedBookings();
  await enrichFirstProfile();
  console.log('✔ اكتملت البيانات التجريبية.');
}

main()
  .catch((e) => {
    console.error('✘ فشلت التعبئة:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
