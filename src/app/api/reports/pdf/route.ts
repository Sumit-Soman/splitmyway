import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
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
    return new Response("No data", { status: 404 });
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: { paidBy: true, participants: { include: { user: true } } },
        orderBy: { date: "desc" },
      },
      settlements: { include: { from: true, to: true }, orderBy: { settledAt: "desc" } },
    },
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SplitMyWay Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0a; color: #e4e4e7; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; }
    th { color: #a1a1aa; font-weight: 600; }
    .muted { color: #71717a; font-size: 0.8rem; }
    .group { margin-bottom: 3rem; page-break-inside: avoid; }
    @media print { body { background: white; color: #18181b; } th { color: #52525b; } }
  </style>
</head>
<body>
  <h1>SplitMyWay Report</h1>
  <p class="muted">Generated for ${escapeHtml(user.email ?? "")}</p>
  ${groups
    .map((g) => {
      const memberIds = g.members.map((m) => m.userId);
      const bal = calculateBalances({
        memberIds,
        expenses: g.expenses.map((e) => ({
          paidById: e.paidById,
          participants: e.participants.map((p) => ({
            userId: p.userId,
            amount: toNumber(p.amount),
          })),
        })),
        settlements: g.settlements.map((s) => ({
          fromId: s.fromId,
          toId: s.toId,
          amount: toNumber(s.amount),
        })),
      });
      const sug = minimizeDebts(bal);
      return `
  <section class="group">
    <h2>${escapeHtml(g.name)} <span class="muted">(${escapeHtml(g.currency)})</span></h2>
    <h3 style="font-size:0.95rem;margin-top:1rem;">Expenses</h3>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Paid by</th><th>Amount</th><th>Original</th></tr></thead>
      <tbody>
        ${g.expenses
          .map(
            (e) => `
        <tr>
          <td>${e.date.toISOString().slice(0, 10)}</td>
          <td>${escapeHtml(e.description)}</td>
          <td>${escapeHtml(e.paidBy.email)}</td>
          <td>${toNumber(e.amount).toFixed(2)} ${escapeHtml(g.currency)}</td>
          <td>${
            e.originalAmount != null && e.originalCurrency
              ? `${toNumber(e.originalAmount).toFixed(2)} ${escapeHtml(e.originalCurrency)}`
              : "—"
          }</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <h3 style="font-size:0.95rem;margin-top:1rem;">Balances</h3>
    <table>
      <thead><tr><th>Member</th><th>Balance</th></tr></thead>
      <tbody>
        ${memberIds
          .map((uid) => {
            const m = g.members.find((x) => x.userId === uid)!;
            return `<tr><td>${escapeHtml(m.user.email)}</td><td>${(bal[uid] ?? 0).toFixed(2)}</td></tr>`;
          })
          .join("")}
      </tbody>
    </table>
    <h3 style="font-size:0.95rem;margin-top:1rem;">Settlement suggestions</h3>
    <ul>
      ${sug.map((s) => `<li>${escapeHtml(g.members.find((m) => m.userId === s.fromId)?.user.email ?? "")} pays ${escapeHtml(g.members.find((m) => m.userId === s.toId)?.user.email ?? "")}: ${s.amount.toFixed(2)}</li>`).join("")}
    </ul>
    <h3 style="font-size:0.95rem;margin-top:1rem;">Settlements</h3>
    <table>
      <thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th></tr></thead>
      <tbody>
        ${g.settlements
          .map(
            (s) => `
        <tr>
          <td>${s.settledAt.toISOString().slice(0, 10)}</td>
          <td>${escapeHtml(s.from.email)}</td>
          <td>${escapeHtml(s.to.email)}</td>
          <td>${toNumber(s.amount).toFixed(2)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </section>`;
    })
    .join("")}
  <p class="muted" style="margin-top:2rem;">Use your browser&rsquo;s Print dialog to save as PDF.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
