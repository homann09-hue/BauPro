import { redirect } from "next/navigation";

export default function LegacyEditMaterialPage() {
  redirect("/materials/inventory");
}
