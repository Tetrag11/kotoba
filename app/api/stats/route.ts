import { NextResponse } from "next/server";
import { hasDatabase, loadStats } from "@/lib/db";

export const dynamic = "force-dynamic";

function validTimeZone(name: string | null): string {
  if (!name || name.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return name;
  } catch {
    return "UTC";
  }
}

export async function GET(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "No database is connected." }, { status: 503 });
  }
  const timeZone = validTimeZone(new URL(request.url).searchParams.get("tz"));
  try {
    return NextResponse.json(await loadStats(timeZone));
  } catch (err) {
    // A zone the browser knows but Postgres doesn't: fall back rather than fail.
    if (timeZone !== "UTC" && /time zone/i.test(String(err))) {
      return NextResponse.json(await loadStats("UTC"));
    }
    console.error("Loading stats failed:", err);
    return NextResponse.json({ error: "Could not load stats." }, { status: 500 });
  }
}
