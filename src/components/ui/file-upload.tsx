'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** رفع ملف إلى /api/upload وإرجاع رابطه — يُستخدم للوثائق وصور الموظفين */
export function FileUpload({
  value,
  folder,
  onChange,
}: {
  value: string;
  folder: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'تعذّر رفع الملف');
        return;
      }
      onChange(data.url);
      toast.success('تم رفع الملف');
    } catch {
      toast.error('تعذّر الاتصال بالخادم');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[var(--text-1)]">الملف المرفق</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {value ? 'استبدال الملف' : 'رفع ملف'}
        </Button>

        {value && (
          <>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-accent hover:underline"
            >
              عرض الملف
            </a>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[13px] text-danger hover:underline"
            >
              إزالة
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--text-2)]">
        JPG أو PNG أو WEBP أو PDF — بحد أقصى 8 ميجابايت
      </p>
    </div>
  );
}
