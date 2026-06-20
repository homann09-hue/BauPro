import { requireAppContext } from "@/lib/auth";
import { defectDetailSelect, defectPhotoSelect } from "@/lib/data/selects";
import { buildDefectPdf, defectFilename } from "@/lib/defect-export";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company, Defect, DefectPhoto } from "@/types/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data: defectData, error } = await supabase
    .from("defects")
    .select(defectDetailSelect)
    .eq("company_id", context.companyId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  const defect = defectData as unknown as Defect | null;
  if (error || !defect?.jobsites) return new Response("Mangel wurde nicht gefunden.", { status: 404 });
  if (!context.canManage && defect.assigned_to !== context.userId && !defect.jobsites.assigned_employee_ids.includes(context.userId)) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const [{ data: companyData }, { data: photoData }] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", context.companyId).single(),
    supabase
      .from("defect_photos")
      .select(defectPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("defect_id", defect.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
  ]);

  const data = {
    company: (companyData as Pick<Company, "id" | "name"> | null) ?? { id: context.companyId, name: context.companyName },
    defect,
    photos: (photoData ?? []) as unknown as Array<Pick<DefectPhoto, "id" | "file_name" | "visible_to_customer" | "created_at">>,
    generatedAt: new Date().toISOString()
  };
  const pdf = buildDefectPdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: downloadHeaders("application/pdf", defectFilename(data))
  });
}
