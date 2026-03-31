import { redirect } from "next/navigation";

export default function AdminCyclesRedirectPage() {
  redirect("/admin/groups");
}
