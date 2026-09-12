'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { openWashMonth } from './actions';

export function OpenWashMonthButton({
  year,
  month,
  label,
}: {
  year: number;
  month: number;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openWashMonth({ year, month });
          if (result.ok) {
            toast.success(result.message ?? 'تم فتح الشهر');
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
      {pending ? 'جارٍ فتح الشهر…' : `فتح شهر ${label}`}
    </Button>
  );
}
