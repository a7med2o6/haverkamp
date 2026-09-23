'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { dateOnlyFromInput, formatDateOnly, formatWeekday } from '@/lib/utils';
import { skipWashDay } from '../actions';

/**
 * دالة تعطيل اليوم كاملاً:
 * أُخرجت من بطاقة الفلاتر إلى زر فرعي في ترويسة الصفحة لتقليل احتمالية الخطأ الكارثي.
 * تفتح نافذة Modal تحتوي على حقل تاريخ فارغ وجملة تحذير صريحة بالنتيجة، وتلغي استخدام window.confirm.
 */
export function BulkDayAction({
  minDate,
  maxDate,
}: {
  minDate: string;
  maxDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  /* يبدأ تاريخ التعطيل فارغاً لفرض اختيار اليوم بوعي دون الاعتماد على القيمة الافتراضية */
  const [date, setDate] = useState('');
  const [reason, setReason] = useState<'HOLIDAY' | 'WEATHER'>('HOLIDAY');
  const [affected, setAffected] = useState<number | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date) return;

    startTransition(async () => {
      const result = await skipWashDay({ date, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const count = Number(result.data?.count ?? 0);
      setAffected(count);
      toast.success(result.message ?? `تم تحديث ${count} غسلة`);
      setOpen(false);
      setDate('');
      router.refresh();
    });
  }

  const selectedDateObj = date ? dateOnlyFromInput(date) : null;
  const dateFormatted = selectedDateObj
    ? `${formatWeekday(selectedDateObj)} ${formatDateOnly(selectedDateObj)}`
    : '';

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        <CalendarX2 className="size-4" />
        تعطيل يوم كامل…
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="تعطيل يوم كامل"
        description="تسجيل جميع الغسلات المخططة ليوم محدد كمتعذرة دفعة واحدة"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              form="bulk-day-action-form"
              variant="danger"
              disabled={pending || !date}
            >
              {pending ? <Loader2 className="animate-spin size-4" /> : <CalendarX2 className="size-4" />}
              تأكيد تعطيل اليوم
            </Button>
          </div>
        }
      >
        <form id="bulk-day-action-form" onSubmit={submit} className="space-y-4">
          <Field label="اليوم المراد تعطيله">
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

          <Field label="سبب التعطيل">
            <Select
              value={reason}
              onChange={(event) => setReason(event.target.value as 'HOLIDAY' | 'WEATHER')}
            >
              <option value="HOLIDAY">عطلة رسمية</option>
              <option value="WEATHER">طقس</option>
            </Select>
          </Field>

          <div className="rounded-[var(--radius-md)] border border-danger/30 bg-[var(--mark-danger)]/10 p-3 text-[13px] text-danger leading-relaxed">
            {date ? (
              <p>
                ستُسجَّل كل الغسلات المخطّطة في <strong>{dateFormatted}</strong> متعذّرة لكل العملاء. يمكن تعويضها بعد ذلك من صفحة كل اشتراك.
              </p>
            ) : (
              <p>
                ستُسجَّل كل الغسلات المخطّطة في اليوم المختار متعذّرة لكل العملاء. يمكن تعويضها بعد ذلك من صفحة كل اشتراك.
              </p>
            )}
          </div>

          {affected !== null && (
            <p className="text-[12px] font-medium text-ok" role="status">
              آخر عملية أثّرت في {affected} غسلة مخطّطة.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
