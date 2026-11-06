import { Study } from "@/components/Study";
import { hasDatabase, loadProgress } from "@/lib/db";
import type { Progress } from "@/lib/session";
import { words } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function Page() {
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
  return <Study words={words} initialProgress={progress} storage={storage} />;
}
