/**
 * يستورد مفاتيح الترجمة من الموقع القديم (legacy/js/i18n.js) إلى جدول translations.
 * التشغيل:  npx tsx prisma/import-translations.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Dict = Record<string, string>;

/** يستخرج أول كائن `var <name> = { ... };` من ملف JS ويقيّمه في sandbox معزول */
function extractObject(source: string, varName: string): Record<string, Dict> | null {
  const startMarker = new RegExp(`var\\s+${varName}\\s*=\\s*\\{`);
  const match = startMarker.exec(source);
  if (!match) return null;

  // نبدأ من القوس المفتوح ونعدّ الأقواس حتى نصل للمقابل
  const open = source.indexOf('{', match.index);
  let depth = 0;
  let inString: string | null = null;
  let end = -1;

  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];

    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) return null;
  const literal = source.slice(open, end);
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 5000 });
}

/** يخمّن مجموعة المفتاح من أول مقطع فيه (nav.services → nav) */
function groupOf(key: string): string {
  const head = key.split('.')[0];
  return head || 'common';
}

async function main() {
  const file = path.join(process.cwd(), 'legacy', 'js', 'i18n.js');
  if (!fs.existsSync(file)) {
    throw new Error(`لم يُعثر على ملف الترجمات: ${file}`);
  }

  const source = fs.readFileSync(file, 'utf8');
  const T = extractObject(source, 'T');
  if (!T?.ar) throw new Error('تعذّر استخراج كائن الترجمات T من الملف');

  // كائن الـ placeholders المنفصل في نهاية الملف
  const PH = extractObject(source.slice(source.indexOf('};', source.indexOf('var T'))), 'PH');

  const ar: Dict = { ...T.ar, ...(PH?.ar ?? {}) };
  const en: Dict = { ...(T.en ?? {}), ...(PH?.en ?? {}) };

  const keys = Array.from(new Set([...Object.keys(ar), ...Object.keys(en)]));
  console.log(`عدد المفاتيح المستخرجة: ${keys.length}`);

  let created = 0;
  let updated = 0;

  for (const key of keys) {
    const arVal = ar[key];
    if (arVal === undefined) continue; // العربية هي المرجع

    const existing = await db.translation.findUnique({ where: { key } });
    if (existing) {
      await db.translation.update({
        where: { key },
        data: { ar: arVal, en: en[key] ?? existing.en, group: groupOf(key) },
      });
      updated++;
    } else {
      await db.translation.create({
        data: { key, ar: arVal, en: en[key] ?? null, group: groupOf(key) },
      });
      created++;
    }
  }

  const groups = await db.translation.groupBy({ by: ['group'], _count: true });
  console.log(`✔ تم الاستيراد — جديد: ${created} · محدّث: ${updated}`);
  console.log(
    'المجموعات:',
    groups
      .sort((a, b) => b._count - a._count)
      .map((g) => `${g.group}(${g._count})`)
      .join(' · ')
  );
}

main()
  .catch((e) => {
    console.error('✘ فشل الاستيراد:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
