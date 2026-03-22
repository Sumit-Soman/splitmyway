import { NextResponse } from "next/server";
import { getRate } from "@/lib/exchange-rates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to" }, { status: 400 });
  }
  try {
    const rate = await getRate(from, to);
    return NextResponse.json({ rate });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
