import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="mt-1 h-4 w-28" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[90px] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <TableSkeleton cols={8} />
    </>
  );
}
