import { redirect } from "next/navigation";

export default function TomorrowBringListsPage() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  redirect(`/bring-lists?date=${date.toISOString().slice(0, 10)}`);
}
