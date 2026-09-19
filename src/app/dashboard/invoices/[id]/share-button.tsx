'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shareInvoice } from '../actions';

/**
 * إرسال الفاتورة للعميل على واتساب.
 *
 * النافذة تُفتح لحظة الضغط ثم يُملأ عنوانها بعد الردّ: نافذةٌ تُفتح بعد
 * انتظار الخادم ليست «من ضغطة المستخدم» في نظر المتصفّح فيحجبها. وعميلٌ
 * بلا رقم يُنسخ له الرابط بدل المحادثة.
 */
export function ShareInvoiceButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  function share() {
    const tab = window.open('', '_blank');
    startTransition(async () => {
      const res = await shareInvoice({ orderId });
      if (!res.ok) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      const { url, whatsapp } = res.data as { url: string; whatsapp: string | null };
      if (whatsapp && tab) {
        tab.location.href = whatsapp;
        return;
      }
      tab?.close();
      try {
        await navigator.clipboard.writeText(url);
        toast.success('لا رقم واتساب للعميل — نُسخ رابط الفاتورة');
      } catch {
        toast.message('رابط الفاتورة', { description: url });
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={share} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Send />}
      واتساب
    </Button>
  );
}
