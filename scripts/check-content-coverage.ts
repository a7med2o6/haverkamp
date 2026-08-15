/**
 * يتحقّق أن محرّر المحتوى يغطّي كل مفاتيح كل صفحة.
 * مفتاح خارج التغطية يعني نصّاً على الموقع لا يمكن تحريره إلا من
 * «نصوص الموقع» — وهو ما بُني المحرّر ليُغني عنه.
 * التشغيل:  npx tsx scripts/check-content-coverage.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { serviceContentKeys } from '../src/lib/service-content';
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

async function main() {
  let uncovered = 0;

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

  console.log(
    uncovered === 0
      ? '\n  ✅ كل المفاتيح مغطّاة'
      : `\n  ⚠ ${uncovered} مفتاحاً خارج المحرّر`
  );
  process.exitCode = uncovered === 0 ? 0 : 1;
}

main().finally(() => db.$disconnect());
