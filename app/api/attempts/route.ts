import { NextResponse } from "next/server";
import { hasDatabase, saveAttempt } from "@/lib/db";
import { allCardIds } from "@/lib/decks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "No database is connected." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const { id, wordId, answer, correct } = body ?? {};
  if (
    typeof id !== "string" ||
    !UUID.test(id) ||
    typeof wordId !== "string" ||
    !allCardIds.has(wordId) ||
    typeof answer !== "string" ||
    answer.length > 200 ||
    typeof correct !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid attempt." }, { status: 400 });
  }
  try {
    await saveAttempt({ id, wordId, answer, correct });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Saving an attempt failed:", err);
    return NextResponse.json({ error: "Could not save the attempt." }, { status: 500 });
  }
}
