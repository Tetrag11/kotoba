import { describe, expect, it } from "vitest";
import {
  missedIds,
  overrideWrong,
  pickWords,
  recordAnswer,
  sessionScore,
  startSession,
  statusOf,
  wordsDone,
  type Progress,
} from "../lib/session";
import type { Word } from "../lib/words";

const list: Word[] = Array.from({ length: 30 }, (_, i) => ({
  id: `w${i}`,
  page: 1,
  kanji: "",
  kana: `k${i}`,
  english: `e${i}`,
}));
const seen = (streak: number, attempts = streak, at = "2026-01-01T00:00:00Z") => ({
  attempts,
  correct: streak,
  streak,
  lastSeen: at,
});

describe("statusOf", () => {
  it("moves from new to learning to learned", () => {
    expect(statusOf(undefined)).toBe("new");
    expect(statusOf(seen(2))).toBe("learning");
    expect(statusOf(seen(3))).toBe("learned");
  });
});

describe("pickWords", () => {
  it("picks the requested number with no duplicates", () => {
    const ids = pickWords(list, {}, 20);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });
  it("mixes review and new words, weakest first", () => {
    const progress: Progress = {};
    for (let i = 0; i < 15; i++) progress[`w${i}`] = seen(i < 5 ? 0 : 2, 3);
    const ids = pickWords(list, progress, 10);
    const review = ids.filter((id) => progress[id]);
    expect(review).toHaveLength(5);
    expect(review.sort()).toEqual(["w0", "w1", "w2", "w3", "w4"]);
  });
  it("leaves learned words until nothing else is left", () => {
    const progress: Progress = {};
    for (let i = 0; i < 28; i++) progress[`w${i}`] = seen(3);
    const ids = pickWords(list, progress, 4);
    expect(ids).toEqual(expect.arrayContaining(["w28", "w29"]));
  });
  it("copes with asking for more words than exist", () => {
    expect(pickWords(list.slice(0, 3), {}, 10)).toHaveLength(3);
  });
});

describe("session", () => {
  it("removes a word once it's right", () => {
    const s = recordAnswer(startSession(["a", "b"]), true);
    expect(s.queue).toEqual(["b"]);
    expect(wordsDone(s)).toBe(1);
  });
  it("brings a wrong word back after a few others", () => {
    const s = recordAnswer(startSession(["a", "b", "c", "d", "e"]), false);
    expect(s.queue).toEqual(["b", "c", "d", "a", "e"]);
    expect(missedIds(s)).toEqual(["a"]);
    expect(wordsDone(s)).toBe(0);
  });
  it("repeats the last word until it's right", () => {
    const s = recordAnswer(startSession(["a"]), false);
    expect(s.queue).toEqual(["a"]);
  });
  it("undoes a wrong mark when the answer is counted as correct", () => {
    const s = overrideWrong(recordAnswer(startSession(["a", "b"]), false), "a");
    expect(s.queue).toEqual(["b"]);
    expect(missedIds(s)).toEqual([]);
    expect(wordsDone(s)).toBe(1);
  });
  it("keeps an earlier miss after a later override", () => {
    let s = recordAnswer(startSession(["a"]), false);
    s = recordAnswer(s, false);
    s = overrideWrong(s, "a");
    expect(missedIds(s)).toEqual(["a"]);
    expect(s.queue).toEqual([]);
  });
  it("scores first tries, including a miss left unfinished", () => {
    let s = startSession(["a", "b", "c"]);
    s = recordAnswer(s, true);
    s = recordAnswer(s, false);
    expect(sessionScore(s)).toEqual({ right: 1, tried: 2 });
    expect(sessionScore(recordAnswer(startSession(["a"]), false))).toEqual({ right: 0, tried: 1 });
  });
});
