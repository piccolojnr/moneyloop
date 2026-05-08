import { permanentRedirect } from "next/navigation";

export default async function LegacyDashboardGroupSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/groups/${id}/setup`);
}
