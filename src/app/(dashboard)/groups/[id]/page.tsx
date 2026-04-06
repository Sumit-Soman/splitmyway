import { notFound } from "next/navigation";
import { getGroupDetailSerialized } from "@/actions/group-detail";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export const dynamic = "force-dynamic";

type GroupTab = "expenses" | "balances" | "members" | "settlements";

function tabFromSearch(tab: string | undefined): GroupTab | undefined {
  if (tab === "expenses" || tab === "balances" || tab === "members" || tab === "settlements") return tab;
  return undefined;
}

/** Members tab only right after creating a group (`?from=create`). Otherwise default to Expenses (ignore bare `?tab=members`). */
function initialTabFromSearch(sp: { tab?: string; from?: string }): GroupTab | undefined {
  if (sp.from === "create") {
    return "members";
  }
  const t = tabFromSearch(sp.tab);
  if (t === "members") {
    return undefined;
  }
  return t;
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; from?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getGroupDetailSerialized(id);
  if (!data) notFound();

  const fromCreate = sp.from === "create";

  return (
    <GroupDetailClient
      data={data}
      initialTab={initialTabFromSearch(sp)}
      replaceUrlAfterCreate={fromCreate}
    />
  );
}
