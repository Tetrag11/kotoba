import { statusOf, type Progress } from "@/lib/session";
import type { Word } from "@/lib/words";

/** One manuscript-paper square per word, filled in as the word is learned. */
export function WordGrid({ words, progress }: { words: Word[]; progress: Progress }) {
  const learned = words.filter((w) => statusOf(progress[w.id]) === "learned").length;
  return (
    <div
      className="word-grid"
      role="img"
      aria-label={`${learned} of ${words.length} words learned`}
    >
      {words.map((w) => (
        <span key={w.id} className={`cell cell-${statusOf(progress[w.id])}`} />
      ))}
    </div>
  );
}
