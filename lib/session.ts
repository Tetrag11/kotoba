export type WordProgress = {
  attempts: number;
  correct: number;
  /** Right answers in a row, up to and including the latest attempt. */
  streak: number;
  lastSeen: string;
};
export type Progress = Record<string, WordProgress>;
export type WordStatus = "new" | "learning" | "learned";

/** A word is learned once it has been right this many times in a row. */
export const LEARNED_STREAK = 3;
/** Wrong words come back after this many other words. */
const REQUEUE_GAP = 3;

export function statusOf(p: WordProgress | undefined): WordStatus {
  if (!p) return "new";
  return p.streak >= LEARNED_STREAK ? "learned" : "learning";
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks a session: up to half is words still being learned, weakest first, and
 * the rest is new words. Learned words only fill whatever room is left.
 */
export function pickWords<T extends { id: string }>(
  words: T[],
  progress: Progress,
  size: number,
  random: () => number = Math.random,
): string[] {
  const byStatus = (status: WordStatus) =>
    shuffle(words, random).filter((w) => statusOf(progress[w.id]) === status);
  const oldestFirst = (a: T, b: T) =>
    progress[a.id].lastSeen.localeCompare(progress[b.id].lastSeen);
  const misses = (w: T) => progress[w.id].attempts - progress[w.id].correct;

  const learning = byStatus("learning").sort(
    (a, b) =>
      progress[a.id].streak - progress[b.id].streak ||
      misses(b) - misses(a) ||
      oldestFirst(a, b),
  );
  const fresh = byStatus("new");
  const learned = byStatus("learned").sort(oldestFirst);

  const review = learning.slice(0, Math.ceil(size / 2));
  const picked = [...review, ...fresh.slice(0, size - review.length)];
  const rest = [...learning.slice(review.length), ...learned];
  picked.push(...rest.slice(0, size - picked.length));
  return shuffle(picked, random).map((w) => w.id);
}

export type Session = {
  total: number;
  /** Counts answers given, so each turn is distinct even when a word repeats. */
  turn: number;
  /** Next word first. A word stays in here until it's answered right. */
  queue: string[];
  /** How many times each word has been answered wrong this session. */
  wrong: Record<string, number>;
};

export function startSession(ids: string[]): Session {
  return { total: ids.length, turn: 0, queue: ids, wrong: {} };
}

export function recordAnswer(session: Session, correct: boolean): Session {
  const [current, ...rest] = session.queue;
  const turn = session.turn + 1;
  if (correct) return { ...session, turn, queue: rest };
  const at = Math.min(REQUEUE_GAP, rest.length);
  return {
    ...session,
    turn,
    queue: [...rest.slice(0, at), current, ...rest.slice(at)],
    wrong: { ...session.wrong, [current]: (session.wrong[current] ?? 0) + 1 },
  };
}

/** Undoes the wrong mark on a word when the learner says their answer was right. */
export function overrideWrong(session: Session, id: string): Session {
  const wrong = { ...session.wrong };
  if (wrong[id] > 1) wrong[id] -= 1;
  else delete wrong[id];
  return { ...session, queue: session.queue.filter((q) => q !== id), wrong };
}

export function wordsDone(session: Session): number {
  return session.total - session.queue.length;
}

export function missedIds(session: Session): string[] {
  return Object.keys(session.wrong);
}

/** First-try score. Words answered wrong count as tried even if the session ended early. */
export function sessionScore(session: Session): { right: number; tried: number } {
  const missed = missedIds(session);
  const unfinished = missed.filter((id) => session.queue.includes(id)).length;
  const tried = wordsDone(session) + unfinished;
  return { right: tried - missed.length, tried };
}
