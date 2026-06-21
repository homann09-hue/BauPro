import { AppShell } from "@/components/app-shell";
import { OfflineQueueProvider } from "@/components/offline-queue-provider";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";
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
      <SessionTimeoutGuard sessionTimeoutMinutes={context.company.session_timeout_minutes} />
      <AppShell context={context}>
        {children}
      </AppShell>
    </OfflineQueueProvider>
  );
}
