'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calculator, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { generatePayroll, setPayrollStatus } from '../actions';

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function GeneratePayrollButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  function onGenerate() {
    startTransition(async () => {
      const res = await generatePayroll({ month, year });
      if (res.ok) {
        toast.success(res.message ?? 'تم التوليد');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Calculator />
        توليد مسيّر رواتب
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="توليد مسيّر رواتب"
          description="يُحتسب الراتب الأساسي والبدلات والساعات الإضافية، ويُخصم الغياب المسجّل في الحضور"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={onGenerate} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                توليد
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الشهر">
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="السنة">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-4 rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3 py-2.5 text-[12px] text-warn">
            إعادة التوليد لنفس الشهر تستبدل القسائم السابقة — متاحة فقط للمسيّرات في حالة مسودة.
          </p>
        </Modal>
      )}
    </>
  );
}

export function PayrollStatusButton({
  id,
  status,
}: {
  id: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const next =
    status === 'DRAFT'
      ? { value: 'APPROVED' as const, label: 'اعتماد المسيّر', variant: 'primary' as const }
      : status === 'APPROVED'
        ? { value: 'PAID' as const, label: 'تسجيل الصرف', variant: 'success' as const }
        : null;

  if (!next) return null;

  function run() {
    startTransition(async () => {
      const res = await setPayrollStatus({ id, status: next!.value });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button variant={next.variant} size="sm" onClick={run} disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {next.label}
    </Button>
  );
}
