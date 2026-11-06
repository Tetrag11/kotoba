import data from "../data/kanji.json";

export type Kanji = {
  /** Built from the character, so adding more kanji later can't shift saved progress. */
  id: string;
  kanji: string;
  english: string;
  /** Other answers that count as right, on top of those in `english`. */
  accept?: string[];
};

export const kanji: Kanji[] = data;
