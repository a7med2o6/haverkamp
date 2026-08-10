'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Wrench } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { BOOKING_STATUS, toOptions } from '@/lib/labels';
import { toLocalInput } from '@/lib/utils';
import { convertBookingToJob, saveBooking, setBookingStatus } from './actions';

export interface BookingValues {
  id?: string;
  customerId?: string | null;
  vehicleId?: string | null;
  serviceId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestCar?: string | null;
  scheduledAt: string;
  notes?: string | null;
  status: string;
}

export function BookingFormButton({
  booking,
  customers,
  services,
}: {
  booking?: BookingValues;
  customers: Array<{ id: string; name: string; phone: string }>;
  services: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!booking?.id;

  const [values, setValues] = useState<BookingValues>(
    booking ?? {
      customerId: '',
      serviceId: '',
      guestName: '',
      guestPhone: '',
      guestCar: '',
      scheduledAt: toLocalInput(new Date(Date.now() + 86400000)),
      notes: '',
      status: 'CONFIRMED',
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof BookingValues>(k: K, v: BookingValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveBooking(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={isEdit ? 'ghost' : 'primary'}
        size={isEdit ? 'icon-sm' : 'md'}
        onClick={() => setOpen(true)}
        aria-label={isEdit ? 'تعديل الحجز' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />حجز جديد</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل الحجز' : 'حجز جديد'}
          description="اختر عميلاً مسجّلاً، أو أدخل بيانات زائر جديد"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="booking-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="booking-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="العميل المسجّل" className="sm:col-span-2">
              <Select
                value={values.customerId ?? ''}
                onChange={(e) => set('customerId', e.target.value)}
              >
                <option value="">— زائر جديد (أدخل البيانات أدناه) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </Select>
            </Field>

            {!values.customerId && (
              <>
                <Field label="اسم الزائر" error={errors.guestName?.[0]}>
                  <Input
                    value={values.guestName ?? ''}
                    onChange={(e) => set('guestName', e.target.value)}
                  />
                </Field>
                <Field label="هاتف الزائر">
                  <Input
                    value={values.guestPhone ?? ''}
                    onChange={(e) => set('guestPhone', e.target.value)}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
                <Field label="السيارة" className="sm:col-span-2">
                  <Input
                    value={values.guestCar ?? ''}
                    onChange={(e) => set('guestCar', e.target.value)}
                    placeholder="مثال: Mercedes G63 2024"
                  />
                </Field>
              </>
            )}

            <Field label="الخدمة">
              <Select
                value={values.serviceId ?? ''}
                onChange={(e) => set('serviceId', e.target.value)}
              >
                <option value="">— غير محدّدة —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الحالة">
              <Select value={values.status} onChange={(e) => set('status', e.target.value)}>
                {toOptions(BOOKING_STATUS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الموعد" className="sm:col-span-2" error={errors.scheduledAt?.[0]}>
              <Input
                type="datetime-local"
                value={values.scheduledAt}
                onChange={(e) => set('scheduledAt', e.target.value)}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function BookingStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      aria-label="تغيير حالة الحجز"
      className="h-8 w-36 text-[12px]"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const res = await setBookingStatus({ id, status: next });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      {toOptions(BOOKING_STATUS).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function ConvertToJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      title="تحويل إلى أمر شغل"
      onClick={() =>
        startTransition(async () => {
          const res = await convertBookingToJob({ id });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.push(`/dashboard/job-orders/${res.id}`);
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Wrench />}
      أمر شغل
    </Button>
  );
}
