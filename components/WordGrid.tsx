import { statusOf, type Progress } from "@/lib/session";
import type { Card } from "@/lib/decks";

/** One manuscript-paper square per card, filled in as it's learned. */
export function WordGrid({
  cards,
  plural,
  progress,
}: {
  cards: Card[];
  plural: string;
  progress: Progress;
}) {
  const learned = cards.filter((c) => statusOf(progress[c.id]) === "learned").length;
  return (
    <div
      className="word-grid"
      role="img"
      aria-label={`${learned} of ${cards.length} ${plural} learned`}
    >
      {cards.map((c) => (
        <span key={c.id} className={`cell cell-${statusOf(progress[c.id])}`} />
      ))}
    </div>
  );
}
