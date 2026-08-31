'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, RotateCw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { markReminderSent } from './actions';

/**
 * زر الإرسال اليدوي.
 *
 * وسم <a> لا زر بمعالج: فتح الواتساب لا بدّ أن يقع في نفس نبضة النقرة
 * وإلا حجبه المتصفّح كنافذة منبثقة، فلا مجال لانتظار الخادم قبل الفتح.
 * لذلك نفتح أولاً ونسجّل الإرسال بعدها، وإن فشل التسجيل بقي الحجز في
 * الطابور — وهو الفشل الآمن: تذكير مكرّر أهون من موعد بلا تذكير.
 */
export function ReminderButton({
  id,
  href,
  sent,
}: {
  id: string;
  /** رابط wa.me برسالة جاهزة — null إذا كان الرقم غير صالح */
  href: string | null;
  sent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!href) {
    return (
      <span className="text-[12px] text-[var(--text-2)]">رقم غير صالح</span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        startTransition(async () => {
          const res = await markReminderSent({ id });
          if (res.ok) router.refresh();
          else toast.error(res.error);
        })
      }
      className={cn(
        buttonVariants({ variant: sent ? 'secondary' : 'success', size: 'sm' }),
        pending && 'pointer-events-none opacity-60'
      )}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : sent ? (
        <RotateCw />
      ) : (
        <Send />
      )}
      {sent ? 'إعادة الإرسال' : 'إرسال'}
    </a>
  );
}
