import data from "../data/kanji.json";

export type Part = { char: string; meaning: string };

export type Example = { word: string; reading: string; english: string };

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
  /** On the JLPT N5 kanji list. Only these are quizzed in Kanji mode. */
  n5?: boolean;
  /**
   * Words from the N5 vocabulary PDF that use this kanji, for N5 kanji only. Words on
   * pages 1 to 11 come first, then the rest of the PDF.
   */
  examples?: Example[];
};

/**
 * Every kanji the app knows: the 80 N5 kanji, in list order, then the other kanji used
 * in the word list. The others aren't quizzed, but their meanings still show under words.
 */
export const kanji: Kanji[] = data;

export const n5Kanji = kanji.filter((k) => k.n5);
