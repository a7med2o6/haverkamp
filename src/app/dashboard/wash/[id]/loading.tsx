import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ تحميل تفاصيل الاشتراك" aria-busy="true">
      <Skeleton className="mb-4 h-5 w-44" />
      <Skeleton className="mb-5 h-64 rounded-[var(--radius-lg)]" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}
