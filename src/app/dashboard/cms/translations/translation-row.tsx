'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { saveTranslation } from '../actions';

/** صف ترجمة قابل للتحرير في مكانه — أسرع من فتح نافذة لكل نص */
export function TranslationRow({
  translationKey,
  ar,
  en,
  group,
  canWrite,
}: {
  translationKey: string;
  ar: string;
  en: string | null;
  group: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ ar, en: en ?? '' });

  function save() {
    startTransition(async () => {
      const res = await saveTranslation({ key: translationKey, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function cancel() {
    setValues({ ar, en: en ?? '' });
    setEditing(false);
  }

  if (editing) {
    return (
      <Tr>
        <Td className="align-top">
          <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
            {translationKey}
          </span>
        </Td>
        <Td className="align-top">
          <Textarea
            value={values.ar}
            onChange={(e) => setValues((v) => ({ ...v, ar: e.target.value }))}
            className="min-h-20 w-full min-w-64"
            autoFocus
          />
        </Td>
        <Td className="align-top">
          <Textarea
            value={values.en}
            onChange={(e) => setValues((v) => ({ ...v, en: e.target.value }))}
            className="min-h-20 w-full min-w-64 text-start"
            dir="ltr"
            placeholder="English…"
          />
        </Td>
        <Td className="align-top">
          <div className="flex items-center gap-1">
            <Button variant="success" size="icon-sm" onClick={save} disabled={pending} aria-label="حفظ">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={cancel} disabled={pending} aria-label="إلغاء">
              <X />
            </Button>
          </div>
        </Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td>
        <span className="tnum block text-[11px] text-[var(--text-2)]" dir="ltr">
          {translationKey}
        </span>
        <Badge className="mt-1">{group}</Badge>
      </Td>
      <Td className="max-w-md text-[13px] text-[var(--text-0)]">{ar}</Td>
      <Td className="max-w-md text-[13px]" dir="ltr">
        {en ? (
          <span className="text-[var(--text-1)]">{en}</span>
        ) : (
          <Badge tone="warn">ناقصة</Badge>
        )}
      </Td>
      <Td>
        {canWrite && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(true)}
            aria-label={`تعديل ${translationKey}`}
          >
            <Pencil />
          </Button>
        )}
      </Td>
    </Tr>
  );
}
