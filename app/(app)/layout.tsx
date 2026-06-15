import { AppShell } from "@/components/app-shell";
import { requireAppContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await requireAppContext();
  return <AppShell context={context}>{children}</AppShell>;
}
