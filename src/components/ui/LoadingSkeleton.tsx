const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-accent/60 ${className}`} />
);

/** Full-page centered loading spinner */
export const PageLoading = ({ message = "Loading…" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
    <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <p className="text-[11px] text-muted-foreground font-medium">{message}</p>
  </div>
);

/** Card skeleton for dashboards */
export const CardSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="card-elevated p-4 space-y-2.5">
    <Skeleton className="h-3 w-1/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-2.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
    ))}
  </div>
);

/** Table skeleton */
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="card-elevated overflow-hidden">
    <div className="px-4 py-2.5 border-b border-border bg-accent/30 flex gap-6">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-2.5 w-16" />
      ))}
    </div>
    <div className="divide-y divide-border/40">
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="px-4 py-3 flex gap-6">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} className={`h-2.5 ${ci === 0 ? "w-28" : "w-14"}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Workspace card skeleton */
export const WorkspaceSkeleton = () => (
  <div className="card-elevated overflow-hidden">
    <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
      <Skeleton className="h-3.5 w-3.5 rounded" />
      <Skeleton className="h-3 w-20" />
    </div>
    <div className="p-4 space-y-2.5">
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-5/6" />
      <Skeleton className="h-2.5 w-4/6" />
    </div>
  </div>
);

export default Skeleton;
