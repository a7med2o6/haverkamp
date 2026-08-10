'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { DOCUMENT_TYPE, toOptions } from '@/lib/labels';
import { deleteDocument, saveDocument } from '../actions';

export interface DocumentValues {
  id?: string;
  employeeId: string;
  type: string;
  number?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
}

export function DocumentFormButton({
  employees,
  document,
}: {
  employees: Array<{ id: string; fullName: string; code: string }>;
  document?: DocumentValues;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!document?.id;

  const [values, setValues] = useState<DocumentValues>(
    document ?? {
      employeeId: '',
      type: 'RESIDENCY',
      number: '',
      issueDate: '',
      expiryDate: '',
      fileUrl: '',
      notes: '',
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof DocumentValues>(k: K, v: DocumentValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveDocument(values);
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
        aria-label={isEdit ? 'تعديل المستند' : undefined}
      >
        {isEdit ? <Pencil /> : <><Plus />مستند جديد</>}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isEdit ? 'تعديل المستند' : 'مستند جديد'}
          description="سجّل تواريخ الانتهاء ليصلك تنبيه قبل ٣٠ يوماً"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="document-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form id="document-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="الموظف" error={errors.employeeId?.[0]}>
              <Select
                value={values.employeeId}
                onChange={(e) => set('employeeId', e.target.value)}
                required
                disabled={isEdit}
              >
                <option value="">— اختر الموظف —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} — {e.fullName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="نوع المستند">
              <Select value={values.type} onChange={(e) => set('type', e.target.value)}>
                {toOptions(DOCUMENT_TYPE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="رقم المستند">
              <Input
                value={values.number ?? ''}
                onChange={(e) => set('number', e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="رابط الملف">
              <Input
                value={values.fileUrl ?? ''}
                onChange={(e) => set('fileUrl', e.target.value)}
                dir="ltr"
                className="text-start"
                placeholder="https://…"
              />
            </Field>

            <Field label="تاريخ الإصدار">
              <Input
                type="date"
                value={values.issueDate ?? ''}
                onChange={(e) => set('issueDate', e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="تاريخ الانتهاء" error={errors.expiryDate?.[0]}>
              <Input
                type="date"
                value={values.expiryDate ?? ''}
                onChange={(e) => set('expiryDate', e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function DeleteDocumentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onDelete() {
    startTransition(async () => {
      const res = await deleteDocument({ id });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحذف');
        setConfirming(false);
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
        onClick={() => setConfirming(true)}
        aria-label="حذف المستند"
      >
        <Trash2 className="text-danger" />
      </Button>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="حذف المستند"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button variant="danger" onClick={onDelete} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                تأكيد الحذف
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-1)]">
            سيتم حذف المستند نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </p>
        </Modal>
      )}
    </>
  );
}
