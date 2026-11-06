import { NextResponse } from "next/server";
import { hasDatabase, loadProgress } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase) return NextResponse.json({ progress: {} });
  try {
    return NextResponse.json({ progress: await loadProgress() });
  } catch (err) {
    console.error("Loading progress failed:", err);
    return NextResponse.json({ error: "Could not load progress." }, { status: 500 });
  }
}
