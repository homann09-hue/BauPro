/**
 * Enhanced loading indicator with better UX
 */

export function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${sizeClasses[size]} border-2 border-ash border-t-primary rounded-full animate-spin`}
        role="status"
        aria-label="Lädt..."
      />
      {text && <p className="text-sm text-ash">{text}</p>}
    </div>
  );
}

export function ProgressLoader({ progress, text }: { progress: number; text?: string }) {
  const percentage = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full space-y-2">
      <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {text && <p className="text-xs text-ash text-center">{text}</p>}
    </div>
  );
}

export function OfflineIndicator() {
  return (
    <div className="bg-yellow-600 text-white px-4 py-2 text-sm rounded flex items-center gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span>Du bist offline. Änderungen werden synchronisiert, sobald du online bist.</span>
    </div>
  );
}
