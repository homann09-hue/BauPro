import { AppShell } from "@/components/app-shell";
import { OfflineQueueProvider } from "@/components/offline-queue-provider";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";
import { requireAppContext } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await requireAppContext();
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? "";
  const isOnboardingRoute = currentPath === "/onboarding" || currentPath.startsWith("/onboarding/");
  const isDebugRoute = currentPath === "/debug/system" || currentPath.startsWith("/debug/");

  if (context.canManage && !context.company.onboarding_completed_at && !isOnboardingRoute && !isDebugRoute) {
    redirect("/onboarding");
  }

  return (
    <OfflineQueueProvider>
      <SessionTimeoutGuard sessionTimeoutMinutes={context.company.session_timeout_minutes} />
      <AppShell context={context}>
        {children}
      </AppShell>
    </OfflineQueueProvider>
  );
}
