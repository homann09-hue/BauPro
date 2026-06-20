export default function OrderDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="h-56 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-96 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
      </div>
    </div>
  );
}
