type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`mq-skeleton ${className}`} aria-hidden="true" />;
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading orders">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mq-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="mq-card p-6 space-y-4" aria-busy="true" aria-label="Loading order">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function WalletSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading wallet">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="mq-card p-5 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mq-card p-5 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mq-card p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function RmaListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading returns">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mq-card p-5 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageLoadingFallback({ label = "Loading" }: { label?: string }) {
  return (
    <div className="mq-container py-20 text-center">
      <div className="inline-flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <p className="sr-only">{label}</p>
      </div>
    </div>
  );
}

export function AdminCardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mq-card p-4 flex flex-wrap justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-[var(--mq-radius-sm)]" />
            <Skeleton className="h-8 w-20 rounded-[var(--mq-radius-sm)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="mq-table-wrap" aria-busy="true" aria-label="Loading table">
      <div className="p-3 bg-mq-surface-subtle flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-3 border-t border-mq-border flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ShopCardSkeleton() {
  return (
    <div className="mq-card p-6 space-y-3" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
