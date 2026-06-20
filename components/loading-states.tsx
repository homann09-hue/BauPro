function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton-line ${className}`} />;
}

export function PageSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="space-y-5" aria-label="Inhalt wird geladen">
      {title ? (
        <div className="surface-strong construction-rail p-5">
          <SkeletonLine className="h-3 w-28" />
          <SkeletonLine className="mt-3 h-8 w-64 max-w-full" />
          <SkeletonLine className="mt-3 h-4 w-full max-w-2xl" />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface p-4">
            <SkeletonLine className="h-10 w-10" />
            <SkeletonLine className="mt-4 h-7 w-20" />
            <SkeletonLine className="mt-2 h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <SkeletonLine className="h-5 w-3/4" />
                <SkeletonLine className="mt-3 h-4 w-1/2" />
                <SkeletonLine className="mt-3 h-4 w-full" />
              </div>
              <SkeletonLine className="h-8 w-20" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <SkeletonLine className="h-16" />
              <SkeletonLine className="h-16" />
              <SkeletonLine className="h-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-label="Formular wird geladen">
      <div className="surface-strong construction-rail p-5">
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="mt-3 h-7 w-56 max-w-full" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14 sm:col-span-2" />
        </div>
      </div>
      <div className="surface p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
          <SkeletonLine className="h-14" />
        </div>
      </div>
      <div className="surface p-5">
        <SkeletonLine className="h-28" />
      </div>
    </div>
  );
}
