/** The parts of a card that decide what counts as right. */
type Gradable = { english: string; accept?: string[] };

export type Grade = "correct" | "close" | "wrong";

/** Reduces an answer to its essentials: "To Open!" and "open" compare equal. */
export function normalize(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const stripped = cleaned.replace(/^(to|a|an|the) /, "");
  return stripped || cleaned;
}

/** Every normalized answer that counts as right for this word. */
export function acceptedAnswers(word: Gradable): Set<string> {
  const listed = word.english.split(/[,;]/);
  return new Set([...listed, ...(word.accept ?? [])].map(normalize).filter(Boolean));
}

/** Edit distance where swapping two neighbouring letters counts as one edit. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...new Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function isClose(answer: string, target: string): boolean {
  if (target.length < 4) return false;
  return distance(answer, target) <= (target.length >= 9 ? 2 : 1);
}

/**
 * "close" means a likely typo. It is never scored as right, because a one-letter
 * slip can be a different word ("night" for "light"); the learner retries instead.
 * Several meanings can be given at once ("foot, leg"), and all of them must be right.
 */
export function grade(word: Gradable, answer: string): Grade {
  const accepted = acceptedAnswers(word);
  const whole = normalize(answer);
  if (accepted.has(whole)) return "correct";

  const parts = answer.split(/[,;/]/).map(normalize).filter(Boolean);
  if (parts.length === 0) return "wrong";
  if (parts.every((part) => accepted.has(part))) return "correct";

  const targets = [...accepted];
  const allNear = parts.every(
    (part) => accepted.has(part) || targets.some((target) => isClose(part, target)),
  );
  return allNear ? "close" : "wrong";
}
