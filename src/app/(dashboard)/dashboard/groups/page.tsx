import { permanentRedirect } from "next/navigation";

export default function LegacyDashboardGroupsPage() {
  permanentRedirect("/groups");
}
