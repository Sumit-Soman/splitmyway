import { getDashboardData } from "@/actions/dashboard";
import { getRecentActivity } from "@/actions/activity";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function DashboardPage() {
  const [data, activity] = await Promise.all([getDashboardData(), getRecentActivity(10)]);

  if (!data) return null;
  const userId = data.user?.id;
  if (!userId) return null;

  return <DashboardHome data={data} activity={activity} userId={userId} />;
}
