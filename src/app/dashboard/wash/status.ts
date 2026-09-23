import { formatDateOnly } from '@/lib/utils';

/**
 * شارة حالة العقد في كل مكان يُعرض فيه.
 *
 * العقد المنتهي يبقى يُغسل حتى آخر يومٍ مدفوع، فـ«منتهٍ» وحدها تكذب ما دام
 * endDate لم يأتِ بعد؛ تقول «ينتهي في …» حتى يأتي. وتُحسب في موضعٍ واحد كي
 * لا تقول صفحة العقد شيئاً وقائمة العقود وبطاقة العميل شيئاً آخر.
 */
export function washStatusBadge(
  subscription: { status: 'ACTIVE' | 'PAUSED' | 'ENDED'; endDate: Date | null },
  today: Date
) {
  if (subscription.status === 'ACTIVE') return { label: 'سارٍ', tone: 'ok' as const };
  if (subscription.status === 'PAUSED') return { label: 'موقوف', tone: 'warn' as const };
  if (subscription.endDate && subscription.endDate >= today) {
    return { label: `ينتهي في ${formatDateOnly(subscription.endDate)}`, tone: 'warn' as const };
  }
  return {
    label: subscription.endDate ? `منتهٍ ${formatDateOnly(subscription.endDate)}` : 'منتهٍ',
    tone: 'muted' as const,
  };
}
