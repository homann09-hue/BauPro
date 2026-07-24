import { AppShell } from "@/components/app-shell";
import { OfflineQueueProvider } from "@/components/offline-queue-provider";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";
import { requireAppContext } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withRouteTiming } from "@/lib/performance/observability";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const xPath = requestHeaders.get("x-pathname") ?? "";
  const referer = requestHeaders.get("referer");
  const resolvedPath = xPath || (() => {
    if (!referer) return "/";
    try {
      return new URL(referer).pathname;
    } catch {
      return "/";
    }
  })();

  return withRouteTiming("app-layout", resolvedPath || "app", async () => {
    const context = await requireAppContext();
    const isOnboardingRoute = resolvedPath === "/onboarding" || resolvedPath.startsWith("/onboarding/");
    const isDebugRoute = resolvedPath === "/debug/system" || resolvedPath.startsWith("/debug/");

    if (context.isChef && !context.company.onboarding_completed_at && !isOnboardingRoute && !isDebugRoute) {
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
  });
}
