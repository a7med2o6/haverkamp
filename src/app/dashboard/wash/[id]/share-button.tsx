'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shareWashSubscription } from '../actions';

/**
 * إرسال رابط متابعة الغسيل للعميل على واتساب.
 *
 * النافذة تُفتح لحظة الضغط ثم يُملأ عنوانها بعد الردّ، تجنّباً لحجب
 * المتصفّح للنوافذ التلقائية. وعند خلوّ حساب العميل من الهاتف، يُنسخ الرابط.
 */
export function ShareWashButton({ subscriptionId }: { subscriptionId: string }) {
  const [pending, startTransition] = useTransition();

  function share() {
    const tab = window.open('', '_blank');
    startTransition(async () => {
      const res = await shareWashSubscription({ id: subscriptionId });
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
        toast.success('لا رقم واتساب للعميل — نُسخ رابط الاشتراك');
      } catch {
        toast.message('رابط الاشتراك', { description: url });
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
