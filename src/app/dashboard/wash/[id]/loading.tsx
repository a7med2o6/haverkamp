import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ تحميل تفاصيل الاشتراك" aria-busy="true">
      {/* العودة إلى الاشتراكات */}
      <Skeleton className="mb-4 h-5 w-44" />

      {/* الترويسة الموحدة */}
      <Skeleton className="mb-5 h-24 rounded-[var(--radius-lg)]" />

      {/* شريط الفترة الحالية — 4 بلاطات */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
      </div>

      {/* جسم الصفحة — عمودان */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* العمود الرئيسي: جدول الغسلات */}
        <Skeleton className="h-[460px] rounded-[var(--radius-lg)]" />

        {/* العمود الجانبي: التفاصيل وبطاقة العميل والإيقافات */}
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-36 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-44 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  );
}
