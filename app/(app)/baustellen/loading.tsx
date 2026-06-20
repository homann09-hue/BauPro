export default function JobsitesLoading() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
      </div>
    </div>
  );
}
