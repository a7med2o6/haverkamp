'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { LEAVE_TYPE, toOptions } from '@/lib/labels';
import { decideLeave, saveLeave } from '../actions';

export function LeaveFormButton({
  employees,
}: {
  employees: Array<{ id: string; fullName: string; code: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [values, setValues] = useState({
    employeeId: '',
    type: 'ANNUAL',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const days =
    Math.round(
      (new Date(values.toDate).getTime() - new Date(values.fromDate).getTime()) / 86400000
    ) + 1;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveLeave(values);
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
      <Button onClick={() => setOpen(true)}>
        <Plus />
        طلب إجازة
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="طلب إجازة جديد"
          description={
            Number.isFinite(days) && days > 0 ? `مدة الإجازة: ${days} يوم` : undefined
          }
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="leave-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ الطلب
              </Button>
            </>
          }
        >
          <form id="leave-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الموظف" className="sm:col-span-2" error={errors.employeeId?.[0]}>
              <Select
                value={values.employeeId}
                onChange={(e) => setValues((v) => ({ ...v, employeeId: e.target.value }))}
                required
              >
                <option value="">— اختر الموظف —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} — {e.fullName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="نوع الإجازة">
              <Select
                value={values.type}
                onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              >
                {toOptions(LEAVE_TYPE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div />

            <Field label="من تاريخ" error={errors.fromDate?.[0]}>
              <Input
                type="date"
                value={values.fromDate}
                onChange={(e) => setValues((v) => ({ ...v, fromDate: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="إلى تاريخ" error={errors.toDate?.[0]}>
              <Input
                type="date"
                value={values.toDate}
                onChange={(e) => setValues((v) => ({ ...v, toDate: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
                required
              />
            </Field>

            <Field label="السبب" className="sm:col-span-2">
              <Textarea
                value={values.reason}
                onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
                placeholder="سبب طلب الإجازة…"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function LeaveDecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  function decide(status: 'APPROVED' | 'REJECTED', decisionNote?: string) {
    startTransition(async () => {
      const res = await decideLeave({ id, status, decisionNote });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setRejecting(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="success"
          size="sm"
          onClick={() => decide('APPROVED')}
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          موافقة
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRejecting(true)} disabled={pending}>
          <X className="text-danger" />
          رفض
        </Button>
      </div>

      {rejecting && (
        <Modal
          open
          onClose={() => setRejecting(false)}
          title="رفض طلب الإجازة"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button variant="danger" onClick={() => decide('REJECTED', note)} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الرفض
              </Button>
            </>
          }
        >
          <Field label="سبب الرفض">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اذكر سبب الرفض ليظهر للموظف…"
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
