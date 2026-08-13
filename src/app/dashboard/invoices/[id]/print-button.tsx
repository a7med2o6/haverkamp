'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * زر الطباعة.
 * مع ‎?print=1‎ يفتح حوار الطباعة تلقائياً — نقطة البيع تفتح الإيصال بهذا
 * الرابط بعد إتمام البيع فيصل الكاشير للطباعة بلا نقرة إضافية.
 */
export function PrintButton() {
  const params = useSearchParams();
  const auto = params.get('print') === '1';
  /** يمنع تكرار الحوار لو أُعيد تركيب المكوّن */
  const printed = useRef(false);

  useEffect(() => {
    if (!auto) return;

    let cancelled = false;

    /**
     * مهلة قصيرة قبل الحوار: الطباعة تلتقط الصفحة كما هي لحظة النداء،
     * فبدونها قد يخرج الإيصال قبل رسم الخطوط والجدول.
     * الحارس داخل الاستدعاء لا قبله — التنظيف في وضع التطوير يُلغي أول
     * مؤقّت، فلو حرسنا بالعَلَم مبكراً لما طُبع شيء أبداً.
     */
    const id = window.setTimeout(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      window.print();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [auto]);

  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer />
      طباعة
    </Button>
  );
}
