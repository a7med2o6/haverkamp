import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ تحميل تغطية الشهر" aria-busy="true">
      <div className="mb-6 flex flex-wrap justify-between gap-3"><div><Skeleton className="mb-2 h-8 w-40" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-8 w-72" /></div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
      <Skeleton className="mb-4 h-36 rounded-[var(--radius-lg)]" />
      <Skeleton className="h-[430px] rounded-[var(--radius-lg)]" />
    </div>
  );
}
