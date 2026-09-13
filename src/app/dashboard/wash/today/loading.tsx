import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ تحميل جولة اليوم" aria-busy="true" className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div><Skeleton className="mb-2 h-8 w-36" /><Skeleton className="h-4 w-52" /></div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-[var(--radius-lg)]" />)}</div>
    </div>
  );
}
