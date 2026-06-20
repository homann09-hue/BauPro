import { PageSkeleton } from "@/components/loading-states";

export default function CustomerPortalLoading() {
  return (
    <main className="min-h-screen bg-fog px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PageSkeleton />
      </div>
    </main>
  );
}
