'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MM_PER_PX = 25.4 / 96;

/**
 * يطابق طول صفحة الإيصال الحراري طولَ الإيصال نفسه.
 *
 * CSS لا يقبل طولاً «تلقائياً» للصفحة، فطولٌ ثابت إمّا يقطع الإيصال
 * الطويل صفحتين أو يُخرج من الطابعة ورقاً أبيض بعد القصير. فيُقاس قبل
 * الطباعة. والقياس بتنسيق الشاشة، وخطّ الطباعة أصغر وحشوها أقل — فالهامش
 * يزيد لا ينقص.
 */
function fitReceiptPage() {
  const receipt = document.querySelector<HTMLElement>('.invoice-receipt');
  let tag = document.getElementById('receipt-page-size');
  if (!receipt) {
    tag?.remove();
    return;
  }
  const mm = Math.ceil(receipt.scrollHeight * MM_PER_PX * 1.05) + 10;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'receipt-page-size';
    document.head.appendChild(tag);
  }
  tag.textContent = `@page { size: 80mm ${mm}mm; margin: 3mm; }`;
}

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

  // Ctrl+P يطبع أيضاً — فالمطابقة قبل كل طباعة لا عند الزرّ وحده
  useEffect(() => {
    window.addEventListener('beforeprint', fitReceiptPage);
    return () => window.removeEventListener('beforeprint', fitReceiptPage);
  }, []);

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
      fitReceiptPage();
      window.print();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [auto]);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        fitReceiptPage();
        window.print();
      }}
    >
      <Printer />
      طباعة
    </Button>
  );
}
