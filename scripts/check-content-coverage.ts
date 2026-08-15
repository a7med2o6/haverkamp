/**
 * يتحقّق أن محرّر المحتوى يغطّي كل مفاتيح كل صفحة.
 * مفتاح خارج التغطية يعني نصّاً على الموقع لا يمكن تحريره إلا من
 * «نصوص الموقع» — وهو ما بُني المحرّر ليُغني عنه.
 * التشغيل:  npx tsx scripts/check-content-coverage.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  OTHER_PAGES,
  homeContentKeys,
  pageContentKeys,
  serviceContentKeys,
} from '../src/lib/service-content';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** الصفحة وبادئة مفاتيحها — البادئة تختلف عن الـ slug أحياناً */
const PAGES: [slug: string, prefix: string][] = [
  ['glass', 'glass'],
  ['polish', 'polish'],
  ['paint', 'paint'],
  ['haverkamp', 'hvk'],
  ['clif', 'clif'],
  ['iron', 'iron'],
  ['tint', 'tint'],
  ['protication', 'ppf'],
  ['wash', 'wash'],
];

/** مجموعات مفاتيح الرئيسية والنصوص المشتركة */
const HOME_GROUPS = ['hero', 'sec', 'why', 'faq', 'contact', 'form', 'nav', 'footer', 'svc'];

async function main() {
  let uncovered = 0;

  // الرئيسية: نقارن بالمجموعات لا بالبادئة
  const homeCovered = new Set(homeContentKeys());
  const homeRows = await db.translation.findMany({
    where: { group: { in: HOME_GROUPS } },
    select: { key: true },
  });
  const homeMissing = homeRows.map((r) => r.key).filter((k) => !homeCovered.has(k));
  uncovered += homeMissing.length;
  console.log(
    `  ${homeMissing.length ? '✗' : '✓'} ${'الرئيسية'.padEnd(12)} ${homeRows.length - homeMissing.length}/${homeRows.length}` +
      (homeMissing.length ? `  ناقص: ${homeMissing.join(', ')}` : '')
  );

  for (const [slug, prefix] of PAGES) {
    const covered = new Set(serviceContentKeys(slug));
    const rows = await db.translation.findMany({
      where: { key: { startsWith: `${prefix}.` } },
      select: { key: true },
    });

    const missing = rows.map((r) => r.key).filter((k) => !covered.has(k));
    uncovered += missing.length;

    const total = rows.length;
    const mark = missing.length === 0 ? '✓' : '✗';
    const tail = missing.length ? `  ناقص: ${missing.join(', ')}` : '';
    console.log(`  ${mark} ${slug.padEnd(12)} ${total - missing.length}/${total}${tail}`);
  }

  // الصفحات الأخرى: البنود والتواصل والإكسسوارات
  for (const [page, meta] of Object.entries(OTHER_PAGES)) {
    const covered = new Set(pageContentKeys(page));
    console.log(`  ✓ ${meta.title.padEnd(18)} ${covered.size} نصاً`);
  }

  // ما لا يصله أي محرّر — إمّا مفاتيح ميتة أو صفحة بلا محرّر
  const everything = new Set([
    ...homeContentKeys(),
    ...PAGES.flatMap(([slug]) => serviceContentKeys(slug)),
    ...Object.keys(OTHER_PAGES).flatMap(pageContentKeys),
  ]);
  const orphans = (await db.translation.findMany({ select: { key: true } }))
    .map((r) => r.key)
    .filter((k) => !everything.has(k));

  if (orphans.length) {
    console.log(`\n  ℹ ${orphans.length} مفتاحاً خارج كل المحرّرات:`);
    console.log(`     ${orphans.join(', ')}`);
  }

  console.log(
    uncovered === 0
      ? '\n  ✅ كل صفحة تغطّي مفاتيحها'
      : `\n  ⚠ ${uncovered} مفتاحاً خارج محرّر صفحته`
  );
  process.exitCode = uncovered === 0 ? 0 : 1;
}

main().finally(() => db.$disconnect());
