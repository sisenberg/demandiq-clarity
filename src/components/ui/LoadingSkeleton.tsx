const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-accent ${className}`} />
);

/** Full-page centered loading spinner */
export const PageLoading = ({ message = "Loading…" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <p className="text-xs text-muted-foreground">{message}</p>
  </div>
);

/** Card skeleton for dashboards */
export const CardSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="card-elevated p-5 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
    ))}
  </div>
);

/** Table skeleton */
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="card-elevated overflow-hidden">
    <div className="px-5 py-3 border-b border-border bg-muted/30 flex gap-6">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-20" />
      ))}
    </div>
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="px-5 py-3.5 flex gap-6">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} className={`h-3 ${ci === 0 ? "w-32" : "w-16"}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Workspace card skeleton */
export const WorkspaceSkeleton = () => (
  <div className="card-elevated overflow-hidden">
    <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="p-5 space-y-3">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  </div>
);

export default Skeleton;
