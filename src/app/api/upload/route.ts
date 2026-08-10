import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const MAX_BYTES = 8 * 1024 * 1024; // 8 ميجابايت

/** الامتدادات المسموحة فقط — نمنع رفع أي شيء قابل للتنفيذ */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'لم يُرفَق ملف' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'حجم الملف يتجاوز 8 ميجابايت' },
      { status: 413 }
    );
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: 'صيغة غير مدعومة — المسموح: JPG، PNG، WEBP، PDF' },
      { status: 415 }
    );
  }

  // اسم عشوائي بالكامل — لا نثق باسم الملف الوارد من المتصفح
  const folder = String(form.get('folder') ?? 'docs').replace(/[^a-z0-9-]/gi, '') || 'docs';
  const filename = `${randomUUID()}.${ext}`;

  const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
  const dir = path.join(uploadRoot, folder);
  await mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
}
