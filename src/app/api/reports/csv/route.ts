import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server-user";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const allowed = new Set(memberships.map((m) => m.groupId));
  const groupIds = groupId ? (allowed.has(groupId) ? [groupId] : []) : [...allowed];

  if (groupIds.length === 0) {
    return new NextResponse("No data", { status: 404 });
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      expenses: {
        include: { paidBy: true, participants: { include: { user: true } } },
        orderBy: { date: "asc" },
      },
    },
  });

  const lines: string[] = [];
  lines.push(
    [
      "group_name",
      "expense_date",
      "description",
      "category",
      "split_method",
      "amount_group_currency",
      "group_currency",
      "original_amount",
      "original_currency",
      "exchange_rate",
      "paid_by",
      "participant_email",
      "participant_share_amount",
    ].join(",")
  );

  for (const g of groups) {
    for (const e of g.expenses) {
      for (const p of e.participants) {
        lines.push(
          [
            csvEscape(g.name),
            e.date.toISOString(),
            csvEscape(e.description),
            csvEscape(e.category),
            csvEscape(e.splitMethod),
            toNumber(e.amount).toFixed(2),
            g.currency,
            e.originalAmount != null ? toNumber(e.originalAmount).toFixed(2) : "",
            e.originalCurrency ?? "",
            e.exchangeRate != null ? toNumber(e.exchangeRate).toString() : "",
            csvEscape(e.paidBy.email),
            csvEscape(p.user.email),
            toNumber(p.amount).toFixed(2),
          ].join(",")
        );
      }
    }
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="splitmyway-report.csv"`,
    },
  });
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
