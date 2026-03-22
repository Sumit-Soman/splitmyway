import Link from "next/link";
import { getGroupsForUser } from "@/actions/groups";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GROUP_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function GroupsPage() {
  const groups = await getGroupsForUser();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-heading">Groups</h1>
          <p className="page-subheading">Manage shared expenses with friends.</p>
        </div>
        <Link href="/groups/new" className={cn(buttonVariants())}>
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <Card className="border-neutral-200 shadow-sm">
          <CardContent className="py-12 text-center text-[15px] leading-relaxed text-neutral-600">
            <p>No groups yet.</p>
            <Link href="/groups/new" className={cn(buttonVariants(), "mt-4 inline-flex")}>
              Create your first group
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="h-full border-neutral-200 shadow-sm transition-colors hover:border-neutral-400">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{g.name}</CardTitle>
                    <Badge variant="outline">
                      {GROUP_CATEGORIES.find((c) => c.value === g.category)?.label ?? g.category}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{g.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 text-sm text-neutral-500">
                  <span>{g.memberCount} members</span>
                  <span>·</span>
                  <span>{g.expenseCount} expenses</span>
                  <span>·</span>
                  <span>{g.currency}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
