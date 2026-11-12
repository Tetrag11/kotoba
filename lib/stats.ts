import type { CardStats, DayStats, Mistake } from "./db";
import type { Card } from "./decks";
import { LEARNED_STREAK, statusOf, type WordStatus } from "./session";

/** Moves a YYYY-MM-DD date by a number of days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Today in the viewer's own time zone, as YYYY-MM-DD. */
export function localDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Days studied in a row. The current run is still alive if the last study day was
 * yesterday, so it doesn't drop to zero first thing in the morning.
 */
export function dayStreaks(studied: string[], today: string): { current: number; longest: number } {
  const set = new Set(studied);
  let longest = 0;
  for (const day of studied) {
    if (set.has(addDays(day, -1))) continue;
    let length = 1;
    while (set.has(addDays(day, length))) length++;
    longest = Math.max(longest, length);
  }
  let start = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(start)) {
    current++;
    start = addDays(start, -1);
  }
  return { current, longest };
}

export type CalendarDay = { day: string; attempts: number; correct: number; future: boolean };

/** Whole weeks ending with the current one, Monday first, for the activity calendar. */
export function calendarWeeks(days: DayStats[], today: string, weeks: number): CalendarDay[][] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday is 0
  const firstMonday = addDays(today, -weekday - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(firstMonday, w * 7 + d);
      const found = byDay.get(day);
      return {
        day,
        attempts: found?.attempts ?? 0,
        correct: found?.correct ?? 0,
        future: day > today,
      };
    }),
  );
}

/** 0 for none, then 1 to 4 by share of the busiest day. */
export function intensity(attempts: number, busiest: number): number {
  if (attempts <= 0 || busiest <= 0) return 0;
  return Math.min(4, Math.ceil((attempts / busiest) * 4));
}

/** The last `n` days up to today, with empty days filled in. */
export function recentDays(days: DayStats[], today: string, n: number): DayStats[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return byDay.get(day) ?? { day, attempts: 0, correct: 0 };
  });
}

export type CardRow = Card & { stats?: CardStats; status: WordStatus; order: number };

export function cardRows(cards: Card[], stats: Record<string, CardStats>): CardRow[] {
  return cards.map((card, order) => ({
    ...card,
    stats: stats[card.id],
    status: statusOf(stats[card.id]),
    order,
  }));
}

export function accuracy(s: { attempts: number; correct: number } | undefined): number | null {
  return s && s.attempts > 0 ? s.correct / s.attempts : null;
}

/** Cards missed at least once and seen at least twice, lowest accuracy first. */
export function hardest(rows: CardRow[], limit: number): CardRow[] {
  return rows
    .filter((r) => r.stats && r.stats.attempts >= 2 && r.stats.correct < r.stats.attempts)
    .sort(
      (a, b) =>
        accuracy(a.stats)! - accuracy(b.stats)! ||
        b.stats!.attempts - b.stats!.correct - (a.stats!.attempts - a.stats!.correct),
    )
    .slice(0, limit);
}

/** Cards one right answer away from being learned, most recently seen first. */
export function nearlyLearned(rows: CardRow[], limit: number): CardRow[] {
  return rows
    .filter((r) => r.stats?.streak === LEARNED_STREAK - 1)
    .sort((a, b) => b.stats!.lastSeen.localeCompare(a.stats!.lastSeen))
    .slice(0, limit);
}

/** Learned cards that haven't been seen for the longest. */
export function longestUnseen(rows: CardRow[], limit: number): CardRow[] {
  return rows
    .filter((r) => r.status === "learned")
    .sort((a, b) => a.stats!.lastSeen.localeCompare(b.stats!.lastSeen))
    .slice(0, limit);
}

/** Wrong answers typed more than once for cards in this deck. */
export function repeatedMistakes(mistakes: Mistake[], rows: CardRow[], limit: number) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return mistakes
    .filter((m) => byId.has(m.wordId))
    .slice(0, limit)
    .map((m) => ({ ...m, card: byId.get(m.wordId)! }));
}

export function statusCounts(rows: CardRow[]): Record<WordStatus, number> {
  const counts = { new: 0, learning: 0, learned: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

export type SortKey = "list" | "most" | "least" | "accuracy" | "recent";

export function sortRows(rows: CardRow[], key: SortKey): CardRow[] {
  const seen = (r: CardRow) => r.stats?.attempts ?? 0;
  const out = [...rows];
  switch (key) {
    case "most":
      return out.sort((a, b) => seen(b) - seen(a) || a.order - b.order);
    case "least":
      return out.sort((a, b) => seen(a) - seen(b) || a.order - b.order);
    case "accuracy":
      // Unseen cards have no accuracy, so they go last.
      return out.sort(
        (a, b) =>
          (accuracy(a.stats) ?? 2) - (accuracy(b.stats) ?? 2) ||
          seen(b) - seen(a) ||
          a.order - b.order,
      );
    case "recent":
      return out.sort(
        (a, b) =>
          (b.stats?.lastSeen ?? "").localeCompare(a.stats?.lastSeen ?? "") || a.order - b.order,
      );
    default:
      return out.sort((a, b) => a.order - b.order);
  }
}

/** "about 2 h 15 min", "about 40 min", "under a minute". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `about ${h} h ${m} min` : `about ${h} h`;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago"... from YYYY-MM-DD days. */
export function formatAgo(day: string, today: string): string {
  const n = daysBetween(day, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  return `${Math.floor(n / 30)} months ago`;
}
