'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EMPLOYEE_STATUS, toOptions } from '@/lib/labels';
import { saveEmployee } from '../actions';

export interface EmployeeValues {
  id?: string;
  fullName: string;
  fullNameEn?: string | null;
  position: string;
  departmentId?: string | null;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  civilId?: string | null;
  birthDate?: string | null;
  hireDate: string;
  contractEnd?: string | null;
  status: string;
  baseSalary: number | string;
  allowance: number | string;
  bankIban?: string | null;
  emergencyContact?: string | null;
  annualLeaveDays: number | string;
  notes?: string | null;
}

const EMPTY: EmployeeValues = {
  fullName: '',
  fullNameEn: '',
  position: '',
  departmentId: '',
  phone: '',
  email: '',
  nationality: '',
  civilId: '',
  birthDate: '',
  hireDate: new Date().toISOString().slice(0, 10),
  contractEnd: '',
  status: 'ACTIVE',
  baseSalary: '',
  allowance: '0',
  bankIban: '',
  emergencyContact: '',
  annualLeaveDays: 30,
  notes: '',
};

export function EmployeeFormButton({
  employee,
  departments,
  variant = 'primary',
}: {
  employee?: EmployeeValues;
  departments: Array<{ id: string; nameAr: string }>;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!employee?.id;

  return (
    <>
      <Button variant={variant} size={isEdit ? 'sm' : 'md'} onClick={() => setOpen(true)}>
        {isEdit ? <Pencil /> : <Plus />}
        {isEdit ? 'تعديل' : 'موظف جديد'}
      </Button>
      {open && (
        <EmployeeModal
          initial={employee ?? EMPTY}
          departments={departments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EmployeeModal({
  initial,
  departments,
  onClose,
}: {
  initial: EmployeeValues;
  departments: Array<{ id: string; nameAr: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof EmployeeValues>(k: K, v: EmployeeValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveEmployee(values);
      if (res.ok) {
        toast.success(res.message ?? 'تم الحفظ');
        onClose();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'تعديل بيانات الموظف' : 'موظف جديد'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button type="submit" form="employee-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={onSubmit} className="space-y-5">
        <Section title="البيانات الشخصية">
          <Field label="الاسم الكامل" error={errors.fullName?.[0]}>
            <Input
              value={values.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="الاسم بالإنجليزية">
            <Input
              value={values.fullNameEn ?? ''}
              onChange={(e) => set('fullNameEn', e.target.value)}
              dir="ltr"
              className="text-start"
            />
          </Field>
          <Field label="الجنسية">
            <Input
              value={values.nationality ?? ''}
              onChange={(e) => set('nationality', e.target.value)}
            />
          </Field>
          <Field label="الرقم المدني">
            <Input
              value={values.civilId ?? ''}
              onChange={(e) => set('civilId', e.target.value)}
              dir="ltr"
              className="text-start tnum"
            />
          </Field>
          <Field label="تاريخ الميلاد">
            <Input
              type="date"
              value={values.birthDate ?? ''}
              onChange={(e) => set('birthDate', e.target.value)}
              dir="ltr"
              className="text-start tnum"
            />
          </Field>
          <Field label="رقم الهاتف" error={errors.phone?.[0]}>
            <Input
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              dir="ltr"
              className="text-start"
              required
            />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email?.[0]}>
            <Input
              type="email"
              value={values.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              dir="ltr"
              className="text-start"
            />
          </Field>
          <Field label="جهة اتصال للطوارئ">
            <Input
              value={values.emergencyContact ?? ''}
              onChange={(e) => set('emergencyContact', e.target.value)}
              placeholder="الاسم والرقم"
            />
          </Field>
        </Section>

        <Section title="بيانات التوظيف">
          <Field label="المسمى الوظيفي" error={errors.position?.[0]}>
            <Input
              value={values.position}
              onChange={(e) => set('position', e.target.value)}
              placeholder="فني تركيب، محاسب…"
              required
            />
          </Field>
          <Field label="القسم">
            <Select
              value={values.departmentId ?? ''}
              onChange={(e) => set('departmentId', e.target.value)}
            >
              <option value="">— بدون قسم —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameAr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تاريخ التعيين" error={errors.hireDate?.[0]}>
            <Input
              type="date"
              value={values.hireDate}
              onChange={(e) => set('hireDate', e.target.value)}
              dir="ltr"
              className="text-start tnum"
              required
            />
          </Field>
          <Field label="نهاية العقد">
            <Input
              type="date"
              value={values.contractEnd ?? ''}
              onChange={(e) => set('contractEnd', e.target.value)}
              dir="ltr"
              className="text-start tnum"
            />
          </Field>
          <Field label="الحالة">
            <Select value={values.status} onChange={(e) => set('status', e.target.value)}>
              {toOptions(EMPLOYEE_STATUS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="رصيد الإجازة السنوية (يوم)" error={errors.annualLeaveDays?.[0]}>
            <Input
              type="number"
              value={values.annualLeaveDays}
              onChange={(e) => set('annualLeaveDays', e.target.value)}
              dir="ltr"
              className="text-start tnum"
              min={0}
              max={365}
            />
          </Field>
        </Section>

        <Section title="الراتب">
          <Field label="الراتب الأساسي (د.ك)" error={errors.baseSalary?.[0]}>
            <Input
              type="number"
              step="0.001"
              value={values.baseSalary}
              onChange={(e) => set('baseSalary', e.target.value)}
              dir="ltr"
              className="text-start tnum"
              placeholder="0.000"
              required
            />
          </Field>
          <Field label="البدلات (د.ك)" error={errors.allowance?.[0]}>
            <Input
              type="number"
              step="0.001"
              value={values.allowance}
              onChange={(e) => set('allowance', e.target.value)}
              dir="ltr"
              className="text-start tnum"
              placeholder="0.000"
            />
          </Field>
          <Field label="رقم الآيبان">
            <Input
              value={values.bankIban ?? ''}
              onChange={(e) => set('bankIban', e.target.value)}
              dir="ltr"
              className="text-start tnum"
              placeholder="KW00 XXXX ..."
            />
          </Field>
        </Section>

        <Field label="ملاحظات">
          <Textarea value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}
