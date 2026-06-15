import { redirect } from "next/navigation";

export default function LegacyNewMaterialPage() {
  redirect("/materials/import");
}
