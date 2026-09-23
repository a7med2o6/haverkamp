'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import { resendInvoiceReceipt } from '../actions';

interface ReceiptStatusProps {
  orderId: string;
  status: string;
  receiptSentAt: Date | string | null;
  receiptError: string | null;
  canResend: boolean;
}

export function ReceiptStatus({
  orderId,
  status,
  receiptSentAt,
  receiptError,
  canResend,
}: ReceiptStatusProps) {
  const [pending, startTransition] = useTransition();

  // لا يظهر شيء إذا كانت الفاتورة غير مسددة بالكامل وليس بها أي سجل إرسال أو عطل
  if (status !== 'COMPLETED' && !receiptSentAt && !receiptError) {
    return null;
  }

  function handleResend() {
    startTransition(async () => {
      const res = await resendInvoiceReceipt({ orderId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  }

  return (
    <div className="inline-flex items-center gap-2 text-[12px]">
      {receiptSentAt ? (
        <span className="inline-flex items-center gap-1 font-medium text-ok">
          <CheckCircle2 className="size-3.5" />
          أُرسل إيصال السداد على واتساب — {formatDateTime(receiptSentAt)}
        </span>
      ) : receiptError ? (
        <span className="inline-flex items-center gap-1 font-medium text-danger">
          <AlertCircle className="size-3.5" />
          تعذّر إرسال الإيصال: {receiptError}
        </span>
      ) : null}

      {canResend && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={pending}
          title="إعادة إرسال إيصال السداد على واتساب"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          إعادة الإرسال
        </Button>
      )}
    </div>
  );
}
