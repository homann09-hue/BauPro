/**
 * Skeleton loader component for improved perceived performance
 */

export function SkeletonLoader({ lines = 3, animated = true }: { lines?: number; animated?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-surface rounded ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${Math.random() * 40 + 60}%`
          }}
        />
      ))}
    </div>
  );
}

export function TableSkeletonLoader({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1 h-10 bg-surface rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeletonLoader() {
  return (
    <div className="border border-line rounded-lg p-4 space-y-3">
      <div className="h-6 bg-surface rounded animate-pulse" />
      <div className="h-4 bg-surface rounded animate-pulse w-3/4" />
      <div className="h-4 bg-surface rounded animate-pulse w-2/3" />
    </div>
  );
}
