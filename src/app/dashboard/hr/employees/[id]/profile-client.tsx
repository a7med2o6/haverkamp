'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { LEAVE_TYPE, toOptions } from '@/lib/labels';
import { FileUpload } from '@/components/ui/file-upload';
import { cn, expiryStatus } from '@/lib/utils';
import { saveDocument, saveLeave } from '../../actions';

/* ═══════════ بطاقة وثيقة ═══════════ */

interface DocValues {
  id: string;
  number: string | null;
  issueDate: string;
  expiryDate: string;
  fileUrl: string | null;
  notes: string | null;
}

export function DocumentTile({
  employeeId,
  type,
  label,
  icon,
  document,
  canWrite,
}: {
  employeeId: string;
  type: string;
  label: string;
  icon: string;
  document: DocValues | null;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const has = !!document;
  const status = expiryStatus(document?.expiryDate || null);

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ??
    Icons.File;

  return (
    <>
      <button
        onClick={() => canWrite && setOpen(true)}
        disabled={!canWrite && !has}
        title={has ? `${label} — ${status.label}` : `${label} — غير مسجّلة`}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border p-4 transition-all',
          has
            ? 'border-[var(--line)] bg-[var(--surface-1)] hover:border-accent'
            : 'border-dashed border-[var(--line)] bg-[var(--surface-2)] opacity-55 hover:opacity-100',
          canWrite && 'cursor-pointer active:scale-[0.98]'
        )}
      >
        <Icon
          className={cn('size-6', has ? 'text-accent' : 'text-[var(--text-2)]')}
        />
        <span
          className={cn(
            'text-[12px] font-medium',
            has ? 'text-[var(--text-0)]' : 'text-[var(--text-2)]'
          )}
        >
          {label}
        </span>

        {/* نقطة حالة الانتهاء */}
        {has && (status.tone === 'danger' || status.tone === 'warn') && (
          <span
            className={cn(
              'absolute end-2 top-2 size-2 rounded-full',
              status.tone === 'danger' ? 'bg-danger' : 'bg-warn'
            )}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <DocumentModal
          employeeId={employeeId}
          type={type}
          label={label}
          document={document}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DocumentModal({
  employeeId,
  type,
  label,
  document,
  onClose,
}: {
  employeeId: string;
  type: string;
  label: string;
  document: DocValues | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    number: document?.number ?? '',
    issueDate: document?.issueDate ?? '',
    expiryDate: document?.expiryDate ?? '',
    fileUrl: document?.fileUrl ?? '',
    notes: document?.notes ?? '',
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveDocument({ id: document?.id, employeeId, type, ...values });
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={label}
      description={document ? 'تعديل بيانات الوثيقة' : 'تسجيل وثيقة جديدة'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button type="submit" form="doc-tile-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </>
      }
    >
      <form id="doc-tile-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الوثيقة" className="sm:col-span-2">
          <Input
            value={values.number}
            onChange={(e) => setValues((v) => ({ ...v, number: e.target.value }))}
            dir="ltr"
            className="tnum text-start"
            autoFocus
          />
        </Field>

        <Field label="تاريخ الإصدار">
          <Input
            type="date"
            value={values.issueDate}
            onChange={(e) => setValues((v) => ({ ...v, issueDate: e.target.value }))}
            dir="ltr"
            className="tnum text-start"
          />
        </Field>

        <Field label="تاريخ الانتهاء">
          <Input
            type="date"
            value={values.expiryDate}
            onChange={(e) => setValues((v) => ({ ...v, expiryDate: e.target.value }))}
            dir="ltr"
            className="tnum text-start"
          />
        </Field>

        <div className="sm:col-span-2">
          <FileUpload
            value={values.fileUrl}
            folder="docs"
            onChange={(url) => setValues((v) => ({ ...v, fileUrl: url }))}
          />
        </div>

        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            className="min-h-16"
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ═══════════ تجديد الوثائق ═══════════ */

export function RenewDocumentsButton({
  employeeId,
  passportExpiry,
  permitExpiry,
  permitType,
}: {
  employeeId: string;
  passportExpiry: string;
  permitExpiry: string;
  permitType: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passport, setPassport] = useState(passportExpiry);
  const [permit, setPermit] = useState(permitExpiry);

  function submit() {
    startTransition(async () => {
      // نحدّث ما تغيّر فقط
      const jobs: Promise<{ ok: boolean; error?: string }>[] = [];

      if (passport && passport !== passportExpiry) {
        jobs.push(saveDocument({ employeeId, type: 'PASSPORT', expiryDate: passport }));
      }
      if (permit && permit !== permitExpiry) {
        jobs.push(saveDocument({ employeeId, type: permitType, expiryDate: permit }));
      }

      if (jobs.length === 0) {
        toast.info('لم تُغيَّر أي تواريخ');
        return;
      }

      const results = await Promise.all(jobs);
      const failed = results.find((r) => !r.ok);

      if (failed) {
        toast.error(failed.error ?? 'تعذّر التحديث');
        return;
      }

      toast.success('تم تحديث تواريخ الوثائق');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="success" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw />
        تجديد الوثائق
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تجديد الوثائق"
          description="حدّث تواريخ انتهاء الجواز والإقامة بعد التجديد"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="انتهاء الإقامة / إذن العمل">
              <Input
                type="date"
                value={permit}
                onChange={(e) => setPermit(e.target.value)}
                dir="ltr"
                className="tnum text-start"
                autoFocus
              />
            </Field>
            <Field label="انتهاء الجواز">
              <Input
                type="date"
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
                dir="ltr"
                className="tnum text-start"
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ═══════════ إضافة إجازة ═══════════ */

export function AddLeaveButton({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [values, setValues] = useState({
    type: 'ANNUAL',
    fromDate: today,
    toDate: today,
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const days =
    Math.round(
      (new Date(values.toDate).getTime() - new Date(values.fromDate).getTime()) / 86400000
    ) + 1;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveLeave({ employeeId, ...values });
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
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        إضافة إجازة
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="إضافة إجازة"
          description={Number.isFinite(days) && days > 0 ? `المدة: ${days} يوم` : undefined}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="profile-leave-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ
              </Button>
            </>
          }
        >
          <form
            id="profile-leave-form"
            onSubmit={onSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="نوع الإجازة" className="sm:col-span-2">
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

            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea
                value={values.reason}
                onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
                className="min-h-16"
                placeholder="سنوية، تغيّر من خادم إلى أهلي…"
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
