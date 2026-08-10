'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn, LogOut, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ATTENDANCE_STATUS, toOptions } from '@/lib/labels';
import { quickCheck, saveAttendance } from '../actions';

/** منتقي التاريخ الذي يتحكّم في اليوم المعروض */
export function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <Input
      type="date"
      value={date}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        p.set('date', e.target.value);
        router.replace(`${pathname}?${p}`, { scroll: false });
      }}
      dir="ltr"
      className="tnum h-10 w-44 text-start"
      aria-label="اختر التاريخ"
    />
  );
}

export function QuickCheckButtons({
  employeeId,
  hasCheckIn,
  hasCheckOut,
  isToday,
}: {
  employeeId: string;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  isToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(kind: 'IN' | 'OUT') {
    startTransition(async () => {
      const res = await quickCheck({ employeeId, kind });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // التسجيل السريع متاح لليوم الحالي فقط
  if (!isToday) return null;

  return (
    <div className="flex items-center gap-1.5">
      {!hasCheckIn && (
        <Button variant="success" size="sm" onClick={() => run('IN')} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
          حضور
        </Button>
      )}
      {hasCheckIn && !hasCheckOut && (
        <Button variant="secondary" size="sm" onClick={() => run('OUT')} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          انصراف
        </Button>
      )}
    </div>
  );
}

export function EditAttendanceButton({
  employeeId,
  employeeName,
  date,
  initial,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  initial: { checkIn: string; checkOut: string; status: string; notes: string };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAttendance({ employeeId, date, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`تعديل حضور ${employeeName}`}
      >
        <Pencil />
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`سجل حضور — ${employeeName}`}
          description={date}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="attendance-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="attendance-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="وقت الحضور">
              <Input
                type="time"
                value={values.checkIn}
                onChange={(e) => setValues((v) => ({ ...v, checkIn: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>
            <Field label="وقت الانصراف">
              <Input
                type="time"
                value={values.checkOut}
                onChange={(e) => setValues((v) => ({ ...v, checkOut: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>
            <Field label="الحالة" className="sm:col-span-2">
              <Select
                value={values.status}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
              >
                {toOptions(ATTENDANCE_STATUS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                placeholder="سبب التأخير، إذن خروج…"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
