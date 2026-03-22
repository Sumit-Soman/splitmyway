import { getReportData } from "@/actions/reports";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const sp = await searchParams;
  const data = await getReportData(sp.groupId ?? null);
  if (!data) return null;

  return <ReportsClient data={data} />;
}
