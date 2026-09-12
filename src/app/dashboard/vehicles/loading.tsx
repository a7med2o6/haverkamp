import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <TableSkeleton cols={7} />
    </>
  );
}
