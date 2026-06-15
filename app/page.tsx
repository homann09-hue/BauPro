import { redirect } from "next/navigation";
import { getOptionalAppContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const context = await getOptionalAppContext();
  redirect(context ? "/dashboard" : "/login");
}
