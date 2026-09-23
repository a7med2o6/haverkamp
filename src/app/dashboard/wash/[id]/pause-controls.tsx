'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { createWashPause, deleteWashPause } from '../actions';

export function AddPauseCollapsible({ subscriptionId }: { subscriptionId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        إضافة إيقاف
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[12px] font-semibold text-[var(--text-1)]">تسجيل إيقاف جديد</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
        >
          <X className="size-4" />
        </Button>
      </div>
      <AddPauseForm subscriptionId={subscriptionId} onDone={() => setOpen(false)} />
    </div>
  );
}

export function AddPauseForm({
  subscriptionId,
  onDone,
}: {
  subscriptionId: string;
  onDone?: () => void;
}) {
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
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3">
      <Field label="من تاريخ" error={errors.fromDate?.[0]}>
        <Input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          dir="ltr"
          className="text-start tnum w-full"
          required
        />
      </Field>
      <Field label="إلى تاريخ" error={errors.toDate?.[0]}>
        <Input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          dir="ltr"
          className="text-start tnum w-full"
          required
        />
      </Field>
      <Field label="السبب" error={errors.reason?.[0]} hint="اختياري">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="سفر العميل، صيانة السيارة…"
          className="min-h-20 w-full"
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <CalendarOff />}
        حفظ الإيقاف
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
