import Link from "next/link";
import { getGroupsForUser } from "@/actions/groups";
import { GroupsList } from "@/components/groups/groups-list";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function GroupsPage() {
  const groups = await getGroupsForUser();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-neutral-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Groups</h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
            Every shared trip, home, or night out — with your balance on each card.
          </p>
        </div>
        <Link href="/groups/new" className={cn(buttonVariants(), "w-full shrink-0 sm:w-auto")}>
          New group
        </Link>
      </header>

      {groups.length === 0 ? (
        <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardContent className="py-14 text-center">
            <p className="text-[15px] font-medium text-neutral-800">No groups yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
              Create a group to split bills and track who owes what.
            </p>
            <Link href="/groups/new" className={cn(buttonVariants(), "mt-6 inline-flex")}>
              Create your first group
            </Link>
          </CardContent>
        </Card>
      ) : (
        <GroupsList groups={groups} />
      )}
    </div>
  );
}
