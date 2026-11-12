import type { Metadata } from "next";
import { Stats } from "@/components/Stats";
import { hasDatabase } from "@/lib/db";

export const metadata: Metadata = { title: "Kotoba stats" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck } = await searchParams;
  return <Stats hasDatabase={hasDatabase} initialDeck={deck === "kanji" ? "kanji" : "words"} />;
}
