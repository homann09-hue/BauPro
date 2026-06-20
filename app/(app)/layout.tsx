import { AppShell } from "@/components/app-shell";
import { OfflineQueueProvider } from "@/components/offline-queue-provider";
import { requireAppContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await requireAppContext();
  return (
    <OfflineQueueProvider>
      <AppShell context={context}>
        {children}
      </AppShell>
    </OfflineQueueProvider>
  );
}
