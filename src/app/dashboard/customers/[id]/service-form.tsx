'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarCheck, Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { toLocalInput } from '@/lib/utils';
import { deleteVehicleService, recordVehicleService } from '../actions';

/**
 * تسجيل زيارة السيرفس الدوري.
 *
 * الغالب أن تُسجَّل والسيارة واقفة، فالتاريخ يأتي معبّأً بالآن ولا يُلمس
 * إلا لتسجيل زيارة فائتة.
 */
export function RecordServiceButton({
  vehicleId,
  label,
  labelled = false,
}: {
  vehicleId: string;
  label: string;
  /** بنصٍّ ظاهر حيث يُطلب التسجيل كثيراً — الأيقونة وحدها لا تُقرأ من أول نظرة */
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visitedAt, setVisitedAt] = useState(() => toLocalInput(new Date()));
  const [notes, setNotes] = useState('');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await recordVehicleService({ vehicleId, visitedAt, notes });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setNotes('');
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
        variant="secondary"
        size={labelled ? 'sm' : 'icon-sm'}
        onClick={() => setOpen(true)}
        title="تسجيل زيارة سيرفس"
        aria-label="تسجيل زيارة سيرفس"
      >
        <CalendarCheck />
        {labelled && 'تسجيل سيرفس'}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تسجيل زيارة سيرفس"
          description={label}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تسجيل
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Field label="تاريخ الزيارة" hint="معبّأ بالآن — غيّره لتسجيل زيارة فائتة">
              <Input
                type="datetime-local"
                value={visitedAt}
                onChange={(e) => setVisitedAt(e.target.value)}
                dir="ltr"
                className="tnum text-start"
                max={toLocalInput(new Date())}
              />
            </Field>
            <Field label="ملاحظات" hint="ما لوحظ على الحماية — اختياري">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

/** حذف زيارة سُجّلت بالخطأ — تُرجِع موعد السيرفس القادم إلى ما قبلها */
export function DeleteServiceButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      title="حذف الزيارة"
      aria-label="حذف الزيارة"
      onClick={() => {
        if (!confirm('حذف هذه الزيارة؟ موعد السيرفس القادم سيُحسب من الزيارة التي قبلها.')) return;
        startTransition(async () => {
          const res = await deleteVehicleService({ id });
          if (res.ok) {
            toast.success(res.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
