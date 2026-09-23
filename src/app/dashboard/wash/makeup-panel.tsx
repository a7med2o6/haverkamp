'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { rescheduleWashVisit, washMakeupOptions } from './actions';

export function MakeupPanel({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingOptions, startLoading] = useTransition();
  const [rescheduling, startReschedule] = useTransition();
  const [options, setOptions] = useState<{
    suggested: string | null;
    min: string;
    max: string;
    dueDate: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  function handleOpen() {
    setIsOpen(true);
    setFetchError(null);
    startLoading(async () => {
      const res = await washMakeupOptions({ visitId });
      if (!res.ok) {
        setFetchError(res.error);
        return;
      }
      if (res.data) {
        const data = res.data as {
          suggested: string | null;
          min: string;
          max: string;
          dueDate: string;
        };
        setOptions(data);
        setSelectedDate(data.suggested ?? '');
      }
    });
  }

  function handleConfirm() {
    if (!selectedDate) {
      toast.error('يُرجى اختيار تاريخ التعويض');
      return;
    }
    startReschedule(async () => {
      const res = await rescheduleWashVisit({ visitId, date: selectedDate });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'تم تحديث موعد الغسلة التعويضية');
      setIsOpen(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setIsOpen(false);
    setOptions(null);
    setFetchError(null);
    setSelectedDate('');
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5 font-bold text-accent border-accent/40 hover:bg-accent/10"
      >
        <Calendar className="size-3.5" />
        تعويض
      </Button>
    );
  }

  return (
    <div className="mt-2.5 rounded-[var(--radius-md)] border border-accent/40 bg-[var(--surface-2)] p-3 text-xs space-y-3">
      <div className="flex items-center justify-between font-bold text-[var(--text-0)]">
        <span>تحديد موعد غسلة تعويضية</span>
      </div>

      {loadingOptions ? (
        <div className="flex items-center gap-2 text-[var(--text-2)] py-2">
          <Loader2 className="size-4 animate-spin text-accent" />
          <span>جاري البحث عن المواعيد المتاحة...</span>
        </div>
      ) : fetchError ? (
        <div className="text-danger py-1 font-semibold">{fetchError}</div>
      ) : options ? (
        <div className="space-y-3">
          {options.suggested === null ? (
            <div className="rounded-[var(--radius-sm)] border border-warn/40 bg-warn/10 p-2 text-warn font-semibold">
              لا يوجد يوم متاح في نافذة التعويض
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-[var(--text-2)]">
              اختر تاريخ التعويض:
            </label>
            <input
              type="date"
              min={options.min}
              max={options.max}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-[var(--text-0)] focus:outline-none focus:ring-1 focus:ring-accent tnum"
              dir="ltr"
            />
            <p className="text-[11px] text-[var(--text-2)]">
              النافذة المتاحة: <span className="tnum font-semibold" dir="ltr">{options.min}</span> إلى <span className="tnum font-semibold" dir="ltr">{options.max}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={rescheduling || !selectedDate}
              className="gap-1.5 font-bold"
            >
              {rescheduling && <Loader2 className="size-3.5 animate-spin" />}
              تأكيد
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={rescheduling}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
