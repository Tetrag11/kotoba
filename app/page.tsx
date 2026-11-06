import { Study } from "@/components/Study";
import { hasDatabase, loadProgress } from "@/lib/db";
import type { Progress } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck } = await searchParams;
  let progress: Progress = {};
  let storage: "ok" | "none" | "error" = hasDatabase ? "ok" : "none";
  if (hasDatabase) {
    try {
      progress = await loadProgress();
    } catch (err) {
      console.error("Loading progress failed:", err);
      storage = "error";
    }
  }
  return (
    <Study
      initialDeck={deck === "kanji" ? "kanji" : "words"}
      initialProgress={progress}
      storage={storage}
    />
  );
}
