import { getSettlementsForUser } from "@/actions/settlements";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { format } from "date-fns";

export default async function SettlementsPage() {
  const rows = await getSettlementsForUser();

  const byGroup = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byGroup.get(r.groupId) ?? [];
    list.push(r);
    byGroup.set(r.groupId, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-heading">Settlements</h1>
        <p className="page-subheading">Recorded payments across your groups.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-neutral-200 shadow-sm">
          <CardContent className="py-12 text-center text-[15px] leading-relaxed text-neutral-600">
            No settlements yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(byGroup.entries()).map(([groupId, list]) => (
            <div key={groupId}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {list[0]?.groupName}
              </h2>
              <div className="space-y-3">
                {list.map((s) => {
                  const paid = s.youPaid;
                  const received = s.youReceived;
                  return (
                    <Card
                      key={s.id}
                      className={`border-neutral-200 shadow-sm ${paid ? "border-l-4 border-l-red-700" : received ? "border-l-4 border-l-neutral-900" : ""}`}
                    >
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[15px] leading-relaxed text-neutral-800">
                            <span className="font-medium">{s.from.name ?? s.from.email}</span>
                            <span className="text-neutral-500"> paid </span>
                            <span className="font-medium">{s.to.name ?? s.to.email}</span>
                          </p>
                          <p className="text-xs text-neutral-500">{format(new Date(s.settledAt), "MMM d, yyyy HH:mm")}</p>
                          {s.notes ? <p className="mt-1 text-xs text-neutral-500">{s.notes}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {paid ? (
                            <Badge variant="destructive">You paid</Badge>
                          ) : received ? (
                            <Badge variant="success">You received</Badge>
                          ) : null}
                          <CurrencyDisplay
                            amount={s.amount}
                            currency={s.currency}
                            direction={paid ? "you-owe" : received ? "owed-to-you" : "neutral"}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
