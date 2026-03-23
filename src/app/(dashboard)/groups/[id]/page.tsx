import { notFound } from "next/navigation";
import { getGroupDetailSerialized } from "@/actions/group-detail";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getGroupDetailSerialized(id);
  if (!data) notFound();

  return <GroupDetailClient data={data} />;
}
