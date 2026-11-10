import data from "../data/kanji.json";

export type Part = { char: string; meaning: string };

export type Kanji = {
  /** Built from the character, so adding more kanji later can't shift saved progress. */
  id: string;
  kanji: string;
  english: string;
  /** Other answers that count as right, on top of those in `english`. */
  accept?: string[];
  /** The pieces it's built from, shown as a hint before answering. */
  parts?: Part[];
  /** A story linking the shape to the meaning. A memory aid, not the kanji's history. */
  tip: string;
  /** How to tell it apart from a kanji that looks similar. */
  similar?: string;
};

export const kanji: Kanji[] = data;
