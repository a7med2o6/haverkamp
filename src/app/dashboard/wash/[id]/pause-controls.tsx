'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { createWashPause, deleteWashPause } from '../actions';

export function AddPauseForm({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await createWashPause({ subscriptionId, fromDate, toDate, reason });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? 'تم تسجيل الإيقاف');
      setFromDate('');
      setToDate('');
      setReason('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:grid-cols-2">
      <Field label="من تاريخ" error={errors.fromDate?.[0]}>
        <Input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          dir="ltr"
          className="text-start tnum"
          required
        />
      </Field>
      <Field label="إلى تاريخ" error={errors.toDate?.[0]}>
        <Input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          dir="ltr"
          className="text-start tnum"
          required
        />
      </Field>
      <Field label="السبب" className="sm:col-span-2" error={errors.reason?.[0]} hint="اختياري">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="سفر العميل، صيانة السيارة…"
          className="min-h-20"
        />
      </Field>
      <Button type="submit" className="sm:col-span-2 sm:justify-self-start" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <CalendarOff />}
        إضافة إيقاف
      </Button>
    </form>
  );
}

export function DeletePauseButton({ pauseId }: { pauseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('إلغاء هذا الإيقاف وإعادة الغسلات القادمة؟')) return;
        startTransition(async () => {
          const result = await deleteWashPause({ pauseId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(result.message ?? 'تم إلغاء الإيقاف');
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      إلغاء الإيقاف
    </Button>
  );
}
