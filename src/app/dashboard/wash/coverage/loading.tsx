import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ تحميل تغطية الشهر" aria-busy="true">
      {/* الترويسة وأزرار الإجراءات والتنقل */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="mb-2 h-8 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-60" />
        </div>
      </div>

      {/* شريط الإحصائيات المدمج */}
      <Skeleton className="mb-4 h-12 w-full rounded-[var(--radius-md)]" />

      {/* شرائح الفلاتر السريعة */}
      <Skeleton className="mb-4 h-16 w-full rounded-[var(--radius-lg)]" />

      {/* شبكة الجدول */}
      <Skeleton className="h-[500px] w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}
