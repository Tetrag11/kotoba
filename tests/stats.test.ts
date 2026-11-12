import { describe, expect, it } from "vitest";
import type { CardStats } from "../lib/db";
import { decks } from "../lib/decks";
import {
  addDays,
  calendarWeeks,
  cardRows,
  dayStreaks,
  formatAgo,
  formatDuration,
  hardest,
  intensity,
  longestUnseen,
  nearlyLearned,
  recentDays,
  repeatedMistakes,
  sortRows,
  statusCounts,
} from "../lib/stats";

const s = (
  attempts: number,
  correct: number,
  streak: number,
  lastSeen = "2026-11-01T00:00:00Z",
): CardStats => ({
  attempts,
  correct,
  gaveUp: 0,
  streak,
  firstSeen: "2026-10-01T00:00:00Z",
  lastSeen,
});

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("says how long ago a day was", () => {
    expect(formatAgo("2026-11-12", "2026-11-12")).toBe("today");
    expect(formatAgo("2026-11-11", "2026-11-12")).toBe("yesterday");
    expect(formatAgo("2026-11-07", "2026-11-12")).toBe("5 days ago");
    expect(formatAgo("2026-10-20", "2026-11-12")).toBe("3 weeks ago");
  });
  it("rounds study time", () => {
    expect(formatDuration(30)).toBe("under a minute");
    expect(formatDuration(40 * 60)).toBe("about 40 min");
    expect(formatDuration(135 * 60)).toBe("about 2 h 15 min");
    expect(formatDuration(120 * 60)).toBe("about 2 h");
  });
});

describe("dayStreaks", () => {
  const today = "2026-11-12";
  it("counts the current run, including today", () => {
    expect(dayStreaks(["2026-11-10", "2026-11-11", "2026-11-12"], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });
  it("keeps the run alive if the last study day was yesterday", () => {
    expect(dayStreaks(["2026-11-10", "2026-11-11"], today).current).toBe(2);
  });
  it("drops to zero after a missed day", () => {
    expect(dayStreaks(["2026-11-09", "2026-11-10"], today).current).toBe(0);
  });
  it("finds the longest run anywhere", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-12"];
    expect(dayStreaks(days, today)).toEqual({ current: 1, longest: 4 });
  });
  it("handles no study at all", () => {
    expect(dayStreaks([], today)).toEqual({ current: 0, longest: 0 });
  });
});

describe("calendar", () => {
  it("builds whole weeks, Monday first, ending this week", () => {
    const weeks = calendarWeeks([{ day: "2026-11-10", attempts: 5, correct: 4 }], "2026-11-12", 3);
    expect(weeks).toHaveLength(3);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[2][0].day).toBe("2026-11-09"); // a Monday
    expect(weeks[2][1]).toMatchObject({ day: "2026-11-10", attempts: 5 });
    expect(weeks[2][3].future).toBe(false);
    expect(weeks[2][4].future).toBe(true);
    expect(weeks[0][0].day).toBe("2026-10-26");
  });
  it("shades by share of the busiest day", () => {
    expect(intensity(0, 40)).toBe(0);
    expect(intensity(1, 40)).toBe(1);
    expect(intensity(20, 40)).toBe(2);
    expect(intensity(40, 40)).toBe(4);
  });
  it("fills in empty recent days", () => {
    const r = recentDays([{ day: "2026-11-11", attempts: 3, correct: 1 }], "2026-11-12", 3);
    expect(r.map((d) => d.attempts)).toEqual([0, 3, 0]);
    expect(r[2].day).toBe("2026-11-12");
  });
});

describe("card lists", () => {
  const cards = decks.words.cards.slice(0, 6);
  const stats: Record<string, CardStats> = {
    [cards[0].id]: s(4, 1, 0),
    [cards[1].id]: s(4, 3, 1),
    [cards[2].id]: s(3, 3, 3, "2026-10-01T00:00:00Z"),
    [cards[3].id]: s(5, 4, 2, "2026-11-05T00:00:00Z"),
    [cards[4].id]: s(1, 0, 0),
  };
  const rows = cardRows(cards, stats);

  it("counts statuses, with unseen cards as new", () => {
    expect(statusCounts(rows)).toEqual({ new: 1, learning: 4, learned: 1 });
  });
  it("puts the lowest accuracy first and needs two sightings", () => {
    expect(hardest(rows, 5).map((r) => r.id)).toEqual([cards[0].id, cards[1].id, cards[3].id]);
  });
  it("finds cards one right answer from learned", () => {
    expect(nearlyLearned(rows, 5).map((r) => r.id)).toEqual([cards[3].id]);
  });
  it("lists learned cards seen longest ago", () => {
    expect(longestUnseen(rows, 5).map((r) => r.id)).toEqual([cards[2].id]);
  });
  it("sorts by how often a card was seen, leaving ties in list order", () => {
    expect(sortRows(rows, "most").map((r) => r.order)).toEqual([3, 0, 1, 2, 4, 5]);
    expect(sortRows(rows, "least")[0].order).toBe(5);
    expect(sortRows(rows, "accuracy").at(-1)!.order).toBe(5);
  });
  it("only shows mistakes for this deck", () => {
    const m = [
      { wordId: cards[0].id, answer: "blue", times: 3, last: "" },
      { wordId: "kanji-貸", answer: "borrow", times: 2, last: "" },
    ];
    expect(repeatedMistakes(m, rows, 5)).toHaveLength(1);
  });
});
