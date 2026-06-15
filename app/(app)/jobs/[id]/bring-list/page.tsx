import { redirect } from "next/navigation";

export default async function JobBringListShortcutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/bring-lists/new?job_id=${id}`);
}
