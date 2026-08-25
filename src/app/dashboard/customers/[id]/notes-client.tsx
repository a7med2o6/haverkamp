'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MessageSquarePlus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { CUSTOMER_NOTE_TYPE, toOptions } from '@/lib/labels';
import {
  addCustomerNote,
  deleteCustomerNote,
  toggleNoteFollowUp,
} from '../actions';

/** تاريخ اليوم المحلي بصيغة <input type="date"> */
function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY = { type: 'CALL', body: '', followUpAt: '' };

export function AddNoteButton({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await addCustomerNote({ customerId, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setValues(EMPTY);
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
        size="sm"
        onClick={() => {
          setValues(EMPTY);
          setOpen(true);
        }}
      >
        <MessageSquarePlus />
        قيد جديد
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="قيد في سجل التواصل"
          description="ما دار مع العميل — يُضاف للسجل ولا يُكتب فوق سابقه"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="note-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                إضافة
              </Button>
            </>
          }
        >
          <form id="note-form" onSubmit={submit} className="space-y-4">
            <Field label="النوع">
              <Select
                value={values.type}
                onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              >
                {toOptions(CUSTOMER_NOTE_TYPE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="التفاصيل" error={errors.body?.[0]}>
              <Textarea
                value={values.body}
                onChange={(e) => setValues((v) => ({ ...v, body: e.target.value }))}
                placeholder="اتصلنا به بخصوص موعد التسليم — طلب التأجيل للأسبوع القادم"
                required
              />
            </Field>

            <Field
              label="متابعة مطلوبة في"
              hint="اتركه فارغاً إن لم تكن هناك متابعة"
            >
              <Input
                type="date"
                value={values.followUpAt}
                min={today()}
                onChange={(e) => setValues((v) => ({ ...v, followUpAt: e.target.value }))}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function FollowUpToggle({
  id,
  done,
}: {
  id: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-2)]">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        className="size-3.5 accent-[var(--color-accent)]"
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            const res = await toggleNoteFollowUp({ id, done: next });
            if (res.ok) router.refresh();
            else toast.error(res.error);
          });
        }}
      />
      تمّت
    </label>
  );
}

export function DeleteNoteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="حذف القيد"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteCustomerNote({ id });
          if (res.ok) {
            toast.success(res.message ?? 'تم الحذف');
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <Trash2 className="text-danger" />
    </Button>
  );
}
