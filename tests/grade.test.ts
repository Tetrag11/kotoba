import { describe, expect, it } from "vitest";
import { acceptedAnswers, grade, normalize } from "../lib/grade";
import { allCardIds, decks } from "../lib/decks";
import { kanji } from "../lib/kanji";
import { words } from "../lib/words";

const byKana = (kana: string, kanji = "") =>
  words.find((w) => w.kana === kana && (!kanji || w.kanji === kanji))!;

describe("normalize", () => {
  it("ignores case, punctuation, leading articles and 'to'", () => {
    expect(normalize("To Open!")).toBe("open");
    expect(normalize("  a CORNER ")).toBe("corner");
    expect(normalize("how much?")).toBe("how much");
    expect(normalize("um...")).toBe("um");
    expect(normalize("café")).toBe("cafe");
    expect(normalize("middle-aged man")).toBe("middle aged man");
  });
  it("drops parenthetical notes", () => {
    expect(normalize("(humble) older brother")).toBe("older brother");
  });
  it("keeps a lone 'to'", () => {
    expect(normalize("to")).toBe("to");
  });
});

describe("grade", () => {
  it.each([
    ["あく", "open"],
    ["あく", "to become open"],
    ["あに", "older brother"],
    ["あき", "fall"],
    ["ある", "to have"],
    ["いくつ", "how old"],
    ["いくつ", "how many?"],
    ["いちにち", "one day"],
    ["あの", "um"],
    ["あの", "that over there"],
    ["いろ", "color"],
    ["かど", "corner"],
    ["あし", "foot, leg"],
    ["あし", "foot/leg"],
    ["おとこ", "man"],
    ["きっさてん", "café"],
  ])("%s accepts %s", (kana, answer) => {
    expect(grade(byKana(kana), answer)).toBe("correct");
  });

  it("uses the right meaning for words that sound alike", () => {
    expect(grade(byKana("あめ", "雨"), "rain")).toBe("correct");
    expect(grade(byKana("あめ", "雨"), "candy")).toBe("wrong");
    expect(grade(byKana("かぜ", "風"), "cold")).toBe("wrong");
    expect(grade(byKana("かぜ", "風邪"), "a cold")).toBe("correct");
  });

  it.each([
    ["あお", "red"],
    ["あし", "foot, hand"],
    ["いぬ", "cat"],
    ["いぬ", ""],
    ["いぬ", "   "],
    ["いぬ", "to"],
    ["あに", "brother"],
  ])("%s rejects %j", (kana, answer) => {
    expect(grade(byKana(kana), answer)).toBe("wrong");
  });

  it("asks for a retry on likely typos, never marks them right", () => {
    expect(grade(byKana("あたたかい"), "wram")).toBe("close");
    expect(grade(byKana("かるい"), "night")).toBe("close");
    expect(grade(byKana("えんぴつ"), "pencl")).toBe("close");
    expect(grade(byKana("カレンダー"), "calender")).toBe("close");
  });

  it("doesn't call short words typos", () => {
    expect(grade(byKana("あか"), "rod")).toBe("wrong");
  });
});

describe("word list", () => {
  it("has every card from pages 1 to 11", () => {
    expect(words).toHaveLength(217);
    expect(new Set(words.map((w) => w.id)).size).toBe(217);
    expect(new Set(words.map((w) => w.page))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  });
  it("shows no two cards with an identical prompt", () => {
    expect(new Set(words.map((w) => `${w.kanji}|${w.kana}`)).size).toBe(words.length);
  });
  it("gives every card at least one answer you can type", () => {
    for (const w of words) expect(acceptedAnswers(w).size).toBeGreaterThan(0);
  });
  it("accepts its own displayed meaning", () => {
    for (const w of words) expect(grade(w, w.english), w.english).toBe("correct");
  });
});

describe("kanji list", () => {
  const byChar = (char: string) => kanji.find((k) => k.kanji === char)!;

  it("has every kanji in the word list, and only those", () => {
    const inWords = new Set(words.flatMap((w) => Array.from(w.kanji)).filter((c) => /\p{sc=Han}/u.test(c)));
    expect(new Set(kanji.map((k) => k.kanji))).toEqual(inWords);
    expect(kanji).toHaveLength(inWords.size);
  });
  it("accepts its own displayed meaning", () => {
    for (const k of kanji) expect(grade(k, k.english), k.kanji).toBe("correct");
  });
  it("accepts each meaning on its own", () => {
    expect(grade(byChar("貸"), "to lend")).toBe("correct");
    expect(grade(byChar("貸"), "lend")).toBe("correct");
    expect(grade(byChar("金"), "money")).toBe("correct");
    expect(grade(byChar("金"), "gold")).toBe("correct");
    expect(grade(byChar("色"), "color")).toBe("correct");
  });
  it("rejects a different kanji's meaning", () => {
    expect(grade(byChar("貸"), "to borrow")).toBe("wrong");
    expect(grade(byChar("赤"), "blue")).toBe("wrong");
  });
  it("gives every kanji a word from the list as an example", () => {
    for (const c of decks.kanji.cards) expect(c.examples?.length, c.prompt).toBeGreaterThan(0);
    const lend = decks.kanji.cards.find((c) => c.prompt === "貸")!;
    expect(lend.examples?.[0].word).toBe("貸す");
  });
  it("shares no ids between decks", () => {
    expect(allCardIds.size).toBe(words.length + kanji.length);
  });
  it("gives every kanji a memory tip", () => {
    for (const k of kanji) expect(k.tip.length, k.kanji).toBeGreaterThan(10);
  });
  it("never gives away an accepted answer in the hint", () => {
    for (const k of kanji) {
      const hint = (k.parts ?? []).map((p) => p.meaning).join(", ");
      if (hint) expect(grade(k, hint), `${k.kanji}: ${hint}`).toBe("wrong");
      for (const p of k.parts ?? []) {
        expect(grade(k, p.meaning), `${k.kanji}: ${p.meaning}`).not.toBe("correct");
      }
    }
  });
  it("lists each kanji's meaning for words, but not for a lone kanji", () => {
    const card = (prompt: string) => decks.words.cards.find((c) => c.prompt === prompt)!;
    expect(card("貸す").kanjiMeanings).toEqual([{ char: "貸", meaning: "to lend" }]);
    expect(card("映画館").kanjiMeanings?.map((p) => p.char)).toEqual(["映", "画", "館"]);
    expect(card("伯父さん/叔父さん").kanjiMeanings?.map((p) => p.char)).toEqual(["伯", "父", "叔"]);
    expect(card("雨").kanjiMeanings).toBeUndefined();
    expect(card("あさって").kanjiMeanings).toBeUndefined();
  });
});
