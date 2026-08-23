'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, Loader2, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { setWarrantyVoid } from './actions';

/** إلغاء الكفالة أو إعادة تفعيلها */
export function VoidWarrantyButton({
  id,
  certificateNo,
  isVoid,
}: {
  id: string;
  certificateNo: string;
  isVoid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');

  function submit() {
    startTransition(async () => {
      const res = await setWarrantyVoid({ id, isVoid: !isVoid, reason });
      if (res.ok) {
        toast.success(res.message ?? 'تم');
        setOpen(false);
        setReason('');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {isVoid ? <RotateCcw /> : <Ban />}
        {isVoid ? 'إعادة التفعيل' : 'إلغاء الكفالة'}
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={isVoid ? 'إعادة تفعيل الكفالة' : 'إلغاء الكفالة'}
          description={certificateNo}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                تراجع
              </Button>
              <Button variant={isVoid ? 'primary' : 'danger'} onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {isVoid ? 'إعادة التفعيل' : 'تأكيد الإلغاء'}
              </Button>
            </>
          }
        >
          {isVoid ? (
            <p className="text-[13px] text-[var(--text-1)]">
              ستعود الشهادة سارية ويُحسب تاريخ انتهائها كما هو.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-[var(--text-1)]">
                لا تُحذف الشهادة — تُعلَّم كملغاة ويبقى سجلّها كاملاً.
              </p>
              <Field label="سبب الإلغاء" hint="يُحفظ داخل بنود الشهادة">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مخالفة شروط الكفالة، إعادة الطلاء لدى جهة أخرى…"
                />
              </Field>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
