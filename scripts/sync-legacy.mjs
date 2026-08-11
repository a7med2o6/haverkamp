/**
 * ينسخ الموقع الثابت القديم من legacy/ إلى public/ ليخدمه Next أثناء التطوير،
 * حتى يظل الموقع العام قابلاً للتصفح على localhost قبل اكتمال نقله.
 *
 * النسخ في public/ متجاهَلة من git — المصدر الوحيد هو legacy/.
 * يُشغَّل تلقائياً مع `npm run dev`. احذف هذا السكربت والـ rewrite في
 * next.config.ts بمجرد اكتمال نقل الموقع العام إلى Next.js.
 */
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * صفحات انتقلت إلى Next — لا تُنسخ، وإلا سبقها الملف الثابت في public/
 * إلى المسار وحجب الصفحة الديناميكية.
 */
const MIGRATED = new Set(['index.html', 'glass.html', 'polish.html', 'paint.html']);

const root = process.cwd();
const legacy = path.join(root, 'legacy');
const publicDir = path.join(root, 'public');

if (!existsSync(legacy)) {
  console.log('· مجلد legacy غير موجود — تم التخطي');
  process.exit(0);
}

async function main() {
  const entries = await readdir(legacy, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    // نتجاهل ملفات المرجع التي لا تُخدَم كجزء من الموقع
    if (entry.name.startsWith('.') || entry.name.endsWith('.md')) continue;
    if (MIGRATED.has(entry.name)) continue;

    const isHtml = entry.isFile() && entry.name.endsWith('.html');
    const isAsset = entry.isDirectory() && (entry.name === 'css' || entry.name === 'js');
    const isRoot =
      entry.isFile() && ['robots.txt', 'sitemap.xml', 'site.webmanifest'].includes(entry.name);

    if (!isHtml && !isAsset && !isRoot) continue;

    const from = path.join(legacy, entry.name);
    const to = path.join(publicDir, entry.name);

    // نحذف الوجهة أولاً حتى لا تبقى ملفات محذوفة من المصدر
    if (isAsset) await rm(to, { recursive: true, force: true });

    await cp(from, to, { recursive: true });
    copied++;
  }

  console.log(`✔ الموقع القديم متاح على / — نُسخ ${copied} عنصر إلى public/`);
}

await mkdir(publicDir, { recursive: true });
await main().catch((e) => {
  console.error('✘ تعذّر نسخ الموقع القديم:', e.message);
  process.exit(1);
});
