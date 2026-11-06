import data from "../data/words.json";

export type Word = {
  id: string;
  /** Page of the JLPT N5 PDF this word came from. */
  page: number;
  /** Empty when the list gives no kanji for the word. */
  kanji: string;
  kana: string;
  english: string;
  /** Other answers that count as right, on top of those in `english`. */
  accept?: string[];
};

export const words: Word[] = data;
