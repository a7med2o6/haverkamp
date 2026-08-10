'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Star } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { saveReview } from '../actions';

export function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`التقييم ${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(
            n <= value ? 'fill-warn text-warn' : 'text-[var(--line-strong)]'
          )}
        />
      ))}
    </span>
  );
}

export function ReviewFormButton({
  employees,
}: {
  employees: Array<{ id: string; fullName: string; code: string }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const now = new Date();
  const [values, setValues] = useState({
    employeeId: '',
    periodLabel: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
    rating: 3,
    strengths: '',
    improvements: '',
    goals: '',
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await saveReview(values);
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
        تقييم جديد
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="تقييم أداء موظف"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button type="submit" form="review-form" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                حفظ التقييم
              </Button>
            </>
          }
        >
          <form id="review-form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الموظف" error={errors.employeeId?.[0]}>
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

              <Field label="فترة التقييم" error={errors.periodLabel?.[0]}>
                <Input
                  value={values.periodLabel}
                  onChange={(e) => setValues((v) => ({ ...v, periodLabel: e.target.value }))}
                  placeholder="Q1 2026"
                  required
                />
              </Field>
            </div>

            <Field label="التقييم العام" error={errors.rating?.[0]}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, rating: n }))}
                      aria-label={`تقييم ${n} من 5`}
                      className="rounded p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          'size-6',
                          n <= values.rating ? 'fill-warn text-warn' : 'text-[var(--line-strong)]'
                        )}
                      />
                    </button>
                  ))}
                </div>
                <span className="tnum text-sm font-semibold text-[var(--text-1)]">
                  {values.rating} / 5
                </span>
              </div>
            </Field>

            <Field label="نقاط القوة">
              <Textarea
                value={values.strengths}
                onChange={(e) => setValues((v) => ({ ...v, strengths: e.target.value }))}
                placeholder="ما الذي يتميّز به الموظف؟"
              />
            </Field>

            <Field label="مجالات التحسين">
              <Textarea
                value={values.improvements}
                onChange={(e) => setValues((v) => ({ ...v, improvements: e.target.value }))}
                placeholder="ما الذي يحتاج تطويراً؟"
              />
            </Field>

            <Field label="أهداف الفترة القادمة">
              <Textarea
                value={values.goals}
                onChange={(e) => setValues((v) => ({ ...v, goals: e.target.value }))}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
