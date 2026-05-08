import { permanentRedirect } from "next/navigation";

export default async function LegacyDashboardGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/groups/${id}`);
}
