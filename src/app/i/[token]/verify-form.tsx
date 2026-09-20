'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyInvoiceAccess } from './actions';

/** أربعة أرقام تُكتب مرّة — ثم يُعاد تحميل الصفحة فتظهر الفاتورة */
export function VerifyForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(verifyInvoiceAccess, { error: null });

  useEffect(() => {
    if (state.error === null && state !== undefined) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="digits" className="mb-1.5 block text-[13px] text-[var(--text-1)]">
          آخر أربعة أرقام من رقم جوّالك
        </label>
        <input
          id="digits"
          name="digits"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="0000"
          dir="ltr"
          className="tnum h-12 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-1)] text-center text-xl tracking-[0.5em] text-[var(--text-0)] outline-none focus:border-accent"
          autoFocus
        />
      </div>

      {state.error && (
        <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        عرض الفاتورة
      </Button>
    </form>
  );
}
