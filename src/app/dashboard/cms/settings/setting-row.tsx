'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { saveSetting } from '../actions';

/** حقل إعداد يحفظ عند التغيير فقط — بلا نموذج ولا نافذة */
export function SettingRow({
  settingKey,
  label,
  value,
  canWrite,
}: {
  settingKey: string;
  label: string;
  value: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);
  const dirty = current !== value;

  const isLatin = /^[\s\d+.:@/-]*$/.test(value) || /^https?:/.test(value);

  function save() {
    startTransition(async () => {
      const res = await saveSetting({ key: settingKey, value: current });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <label
        htmlFor={`setting-${settingKey}`}
        className="mb-1.5 block text-[12px] text-[var(--text-2)]"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={`setting-${settingKey}`}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={!canWrite}
          dir={isLatin ? 'ltr' : undefined}
          className={isLatin ? 'text-start' : undefined}
        />
        {canWrite && dirty && (
          <Button variant="success" size="icon" onClick={save} disabled={pending} aria-label="حفظ">
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
        )}
      </div>
    </div>
  );
}
