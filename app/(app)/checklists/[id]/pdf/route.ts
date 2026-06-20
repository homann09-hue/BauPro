import { buildChecklistPdf, checklistFilename } from "@/lib/checklist-export";
import { requireAppContext } from "@/lib/auth";
import { checklistItemPhotoSelect, jobsiteChecklistDetailSelect, jobsiteChecklistItemSelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChecklistItemPhoto, JobsiteChecklist, JobsiteChecklistItem } from "@/types/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data: checklistData } = await supabase
    .from("jobsite_checklists")
    .select(jobsiteChecklistDetailSelect)
    .eq("company_id", context.companyId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  const checklist = checklistData as unknown as JobsiteChecklist | null;
  if (!checklist?.jobsites) return new Response("Checkliste wurde nicht gefunden.", { status: 404 });
  if (!context.canManage && !checklist.jobsites.assigned_employee_ids.includes(context.userId)) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const [itemsResult, photosResult] = await Promise.all([
    supabase
      .from("jobsite_checklist_items")
      .select(jobsiteChecklistItemSelect)
      .eq("company_id", context.companyId)
      .eq("checklist_id", checklist.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("checklist_item_photos")
      .select(checklistItemPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("checklist_id", checklist.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
  ]);

  const items = (itemsResult.data ?? []) as unknown as JobsiteChecklistItem[];
  const photos = (photosResult.data ?? []) as unknown as ChecklistItemPhoto[];
  const photosByItem = new Map<string, ChecklistItemPhoto[]>();
  for (const photo of photos) {
    const list = photosByItem.get(photo.checklist_item_id) ?? [];
    list.push(photo);
    photosByItem.set(photo.checklist_item_id, list);
  }

  const data = {
    companyName: context.companyName,
    checklist,
    items,
    photosByItem,
    generatedAt: new Date().toISOString()
  };
  const pdf = buildChecklistPdf(data);

  return new Response(pdf, {
    headers: downloadHeaders("application/pdf", checklistFilename(data))
  });
}
