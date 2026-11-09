import { kanji, type Part } from "./kanji";
import { words } from "./words";

export type Example = { word: string; reading: string; english: string };

/** One thing to be quizzed on, whichever deck it comes from. */
export type Card = {
  id: string;
  prompt: string;
  reading?: string;
  english: string;
  accept?: string[];
  /** Words from the vocabulary list that use this kanji. */
  examples?: Example[];
  parts?: Part[];
  tip?: string;
  similar?: string;
};

export type DeckId = "words" | "kanji";

export type Deck = {
  label: string;
  /** What one card is called in buttons and messages. */
  singular: string;
  plural: string;
  description: string;
  cards: Card[];
};

const MAX_EXAMPLES = 3;

function examplesFor(char: string): Example[] {
  return words
    .filter((w) => w.kanji.includes(char))
    .sort((a, b) => a.kanji.length - b.kanji.length)
    .slice(0, MAX_EXAMPLES)
    .map((w) => ({ word: w.kanji, reading: w.kana, english: w.english }));
}

export const decks: Record<DeckId, Deck> = {
  words: {
    label: "Words",
    singular: "word",
    plural: "words",
    description: "JLPT N5 vocabulary, pages 1 to 11",
    cards: words.map((w) => ({
      id: w.id,
      prompt: w.kanji || w.kana,
      reading: w.kanji ? w.kana : undefined,
      english: w.english,
      accept: w.accept,
    })),
  },
  kanji: {
    label: "Kanji",
    singular: "kanji",
    plural: "kanji",
    description: `The ${kanji.length} kanji from JLPT N5 pages 1 to 11, one at a time`,
    cards: kanji.map((k) => ({
      id: k.id,
      prompt: k.kanji,
      english: k.english,
      accept: k.accept,
      examples: examplesFor(k.kanji),
      parts: k.parts,
      tip: k.tip,
      similar: k.similar,
    })),
  },
};

export const allCardIds = new Set(Object.values(decks).flatMap((d) => d.cards.map((c) => c.id)));
