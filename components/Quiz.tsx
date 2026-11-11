"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { grade } from "@/lib/grade";
import { overrideWrong, recordAnswer, wordsDone, type Session } from "@/lib/session";
import type { Card } from "@/lib/decks";
import type { Part } from "@/lib/kanji";

type Attempt = { id: string; wordId: string; answer: string; correct: boolean };
type Result = { correct: boolean; attemptId: string; gaveUp: boolean };

export function Quiz({
  session,
  byId,
  singular,
  showReading,
  onChange,
  onFinish,
  onSave,
}: {
  session: Session;
  byId: Map<string, Card>;
  singular: string;
  /** Words show their reading. Kanji show the character alone. */
  showReading: boolean;
  onChange: (session: Session) => void;
  onFinish: (session: Session) => void;
  onSave: (attempt: Attempt) => void;
}) {
  // The parent remounts this for every turn, so this state is per answer.
  const card = byId.get(session.queue[0])!;
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [closeHint, setCloseHint] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [afterAnswer, setAfterAnswer] = useState<Session | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  function mark(correct: boolean, typed: string, gaveUp: boolean) {
    const attemptId = crypto.randomUUID();
    onSave({ id: attemptId, wordId: card.id, answer: typed, correct });
    setResult({ correct, attemptId, gaveUp });
    setAfterAnswer(recordAnswer(session, correct));
    setCloseHint(false);
    input.current?.focus();
  }

  function next(state: Session) {
    if (state.queue.length === 0) onFinish(state);
    else onChange(state);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (afterAnswer) return next(afterAnswer);
    if (!answer.trim()) return;
    const verdict = grade(card, answer);
    if (verdict === "close" && !closeHint) {
      setCloseHint(true);
      input.current?.select();
      return;
    }
    mark(verdict === "correct", answer.trim(), false);
  }

  function countAsCorrect() {
    if (!result || !afterAnswer) return;
    onSave({ id: result.attemptId, wordId: card.id, answer: answer.trim(), correct: true });
    setResult({ ...result, correct: true });
    setAfterAnswer(overrideWrong(afterAnswer, card.id));
    input.current?.focus();
  }

  const done = afterAnswer ? wordsDone(afterAnswer) : wordsDone(session);
  const chars = Array.from(card.prompt);

  return (
    <main className="sheet quiz">
      <header className="quiz-bar">
        <p>
          {done} of {session.total} done
        </p>
        <button className="quiet" type="button" onClick={() => onFinish(afterAnswer ?? session)}>
          End session
        </button>
      </header>

      <div className="prompt">
        {showReading && (
          <p lang="ja" className="reading" aria-hidden={!card.reading}>
            {card.reading ?? "\u00a0"}
          </p>
        )}
        <div className="manuscript" style={{ "--n": chars.length } as React.CSSProperties}>
          <h1 lang="ja" aria-label={card.prompt}>
            {chars.map((char, i) => (
              <span key={i} aria-hidden="true">
                {char}
              </span>
            ))}
          </h1>
          {result && <RedPen correct={result.correct} />}
        </div>
        {showParts && !result && card.parts && <Parts parts={card.parts} />}
      </div>

      <form onSubmit={submit} className="answer">
        <label htmlFor="answer">What does it mean in English?</label>
        <input
          id="answer"
          ref={input}
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setCloseHint(false);
          }}
          readOnly={Boolean(result)}
          maxLength={200}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint={result ? "next" : "done"}
        />

        <div className="feedback" role="status">
          {closeHint && <p className="close">Close. Check the spelling and try again.</p>}
          {result && (
            <>
              <p className={result.correct ? "verdict right" : "verdict wrong"}>
                {result.correct ? "Correct" : result.gaveUp ? "Here’s the answer" : "Not quite"}
              </p>
              <p className="meaning">{card.english}</p>
              {!result.correct && (
                <p className="hint">This {singular} will come back in a moment.</p>
              )}
              {card.kanjiMeanings && <Parts parts={card.kanjiMeanings} label="Kanji in this word" />}
            </>
          )}
        </div>

        <div className="actions">
          <button className="primary" type="submit">
            {!result
              ? "Check"
              : afterAnswer?.queue.length === 0
                ? "See results"
                : `Next ${singular}`}
          </button>
          {!result && card.parts && !showParts && (
            <button
              className="quiet"
              type="button"
              onClick={() => {
                setShowParts(true);
                input.current?.focus();
              }}
            >
              Show a hint
            </button>
          )}
          {!result && (
            <button className="quiet" type="button" onClick={() => mark(false, "", true)}>
              I don’t know
            </button>
          )}
          {result && !result.correct && !result.gaveUp && (
            <button className="quiet" type="button" onClick={countAsCorrect}>
              Count as correct
            </button>
          )}
        </div>
      </form>

      {result && card.tip && (
        <section className="remember" aria-label="How to remember it">
          <p className="hint">How to remember it</p>
          {card.parts && <Parts parts={card.parts} />}
          <p>
            <JaText text={card.tip} />
          </p>
          {card.similar && (
            <p className="similar">
              <JaText text={card.similar} />
            </p>
          )}
        </section>
      )}

      {result && card.examples && card.examples.length > 0 && (
        <section aria-label="Words that use this kanji">
          <p className="hint">In your word list</p>
          <ul className="missed">
            {card.examples.map((e) => (
              <li key={e.word + e.reading}>
                <span lang="ja" className="missed-word">
                  {e.word}
                </span>
                <span lang="ja" className="missed-kana">
                  {e.reading}
                </span>
                <span>{e.english}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** The teacher's mark: a red circle for right, a red cross for wrong. */
function RedPen({ correct }: { correct: boolean }) {
  return (
    <svg className="red-pen" viewBox="0 0 100 100" aria-hidden="true">
      {correct ? (
        <path
          pathLength={1}
          d="M58 7C30 2 6 20 5 48c-1 27 22 46 49 45 27-1 43-22 41-47C93 20 72 4 44 9"
        />
      ) : (
        <>
          <path pathLength={1} d="M14 12C36 36 62 62 87 89" />
          <path pathLength={1} className="second" d="M86 11C62 36 38 63 13 88" />
        </>
      )}
    </svg>
  );
}

/** The pieces a kanji is built from, such as 門 gate + 耳 ear. */
function Parts({ parts, label = "Parts" }: { parts: Part[]; label?: string }) {
  return (
    <ul className="parts" aria-label={label}>
      {parts.map((p, i) => (
        <li key={i}>
          <span lang="ja">{p.char}</span> {p.meaning}
        </li>
      ))}
    </ul>
  );
}

const JAPANESE = /([\u2e80-\u2fdf\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+)/;

/** English text with Japanese runs marked, so they use the Japanese font. */
function JaText({ text }: { text: string }) {
  return text
    .split(JAPANESE)
    .map((run, i) => (i % 2 === 1 ? <span key={i} lang="ja">{run}</span> : run));
}
