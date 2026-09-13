'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { skipWashDay } from '../actions';

export function BulkDayAction({
  minDate,
  maxDate,
  initialDate,
}: {
  minDate: string;
  maxDate: string;
  initialDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(initialDate);
  const [reason, setReason] = useState<'HOLIDAY' | 'WEATHER'>('HOLIDAY');
  const [affected, setAffected] = useState<number | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const reasonLabel = reason === 'HOLIDAY' ? 'عطلة رسمية' : 'طقس';
    if (!window.confirm(`تسجيل كل الغسلات المخطّطة في ${date} كمتعذّرة بسبب «${reasonLabel}»؟`)) {
      return;
    }
    startTransition(async () => {
      const result = await skipWashDay({ date, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const count = Number(result.data?.count ?? 0);
      setAffected(count);
      toast.success(result.message ?? `تم تحديث ${count} غسلة`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto] sm:items-end">
      <Field label="اليوم">
        <Input
          type="date"
          min={minDate}
          max={maxDate}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          dir="ltr"
          className="text-start tnum"
          required
        />
      </Field>
      <Field label="السبب">
        <Select value={reason} onChange={(event) => setReason(event.target.value as 'HOLIDAY' | 'WEATHER')}>
          <option value="HOLIDAY">عطلة رسمية</option>
          <option value="WEATHER">طقس</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="h-10">
        {pending ? <Loader2 className="animate-spin" /> : <CalendarX2 />}
        تعطيل اليوم
      </Button>
      {affected !== null && (
        <p className="text-[12px] font-medium text-ok sm:col-span-3" role="status">
          آخر عملية أثّرت في {affected} غسلة مخطّطة.
        </p>
      )}
    </form>
  );
}
