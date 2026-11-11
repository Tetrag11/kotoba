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
  const card = byId.get(session.queue[0])!;
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [closeHint, setCloseHint] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [afterAnswer, setAfterAnswer] = useState<Session | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);

  // This stays mounted for the whole session so the answer box keeps focus, and a phone
  // keyboard stays open from one card to the next. Per-card state resets here instead.
  const [turn, setTurn] = useState(session.turn);
  if (turn !== session.turn) {
    setTurn(session.turn);
    setAnswer("");
    setResult(null);
    setCloseHint(false);
    setShowParts(false);
    setAfterAnswer(null);
  }

  useEffect(() => input.current?.focus(), []);
  useKeyboardOffset(input, actions);

  // A new card starts from the top, with the answer box clear of the keyboard and buttons.
  useEffect(() => {
    if (!isPinned(actions.current)) return;
    window.scrollTo(0, 0);
    keepVisible(input.current, actions.current);
  }, [session.turn]);

  // Show the result too, as far as possible without hiding what was typed.
  useEffect(() => {
    if (result) keepVisible(feedback.current, actions.current, input.current);
  }, [result]);

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
    onSave({
      id: result.attemptId,
      wordId: card.id,
      answer: answer.trim(),
      correct: true,
    });
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

      {/* One form around the whole card, so on phones the buttons can rise anywhere above the keyboard. */}
      <form onSubmit={submit} className="quiz-form">
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

        <div className="answer">
          <label htmlFor="answer">What does it mean in English?</label>
          <input
            id="answer"
            ref={input}
            value={answer}
            onFocus={() => keepVisible(input.current, actions.current)}
            onChange={(e) => {
              // Not readOnly once answered: that would close the phone keyboard.
              if (result) return;
              setAnswer(e.target.value);
              setCloseHint(false);
              keepVisible(input.current, actions.current);
            }}
            className={result ? "answered" : undefined}
            aria-readonly={Boolean(result)}
            maxLength={200}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
          />

          <div className="feedback" role="status" ref={feedback}>
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
                {card.kanjiMeanings && (
                  <Parts parts={card.kanjiMeanings} label="Kanji in this word" />
                )}
              </>
            )}
          </div>
        </div>

        <div className="actions" ref={actions}>
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
      </form>
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
  return text.split(JAPANESE).map((run, i) =>
    i % 2 === 1 ? (
      <span key={i} lang="ja">
        {run}
      </span>
    ) : (
      run
    ),
  );
}

/** True when the buttons are pinned above the keyboard, which happens on phone-sized screens. */
function isPinned(bar: HTMLElement | null): bar is HTMLElement {
  return bar !== null && getComputedStyle(bar).position === "sticky";
}

/**
 * Scrolls as little as possible so `target` sits between the top of the screen and the
 * pinned buttons. With `keep`, it never scrolls so far that `keep` goes off the top.
 */
function keepVisible(
  target: HTMLElement | null,
  bar: HTMLElement | null,
  keep?: HTMLElement | null,
) {
  const viewport = window.visualViewport;
  if (!target || !viewport || !isPinned(bar)) return;
  const top = viewport.offsetTop + 8;
  const bottom = viewport.offsetTop + viewport.height - bar.offsetHeight - 8;
  const box = target.getBoundingClientRect();
  if (box.bottom > bottom) {
    const highest = (keep ?? target).getBoundingClientRect().top - top;
    const by = Math.min(box.bottom - bottom, highest);
    if (by > 0) window.scrollBy(0, by);
  } else if (box.top < top) {
    window.scrollBy(0, box.top - top);
  }
}

/**
 * Sets --keyboard to the height of the screen hidden by an on-screen keyboard, so the
 * buttons can sit just above it. Android browsers resize the page for the keyboard
 * instead (see interactiveWidget in the layout), which leaves --keyboard at zero.
 * Whenever the visible area changes size, the answer box is moved clear of the keyboard
 * and buttons. That runs again shortly after, because the browser does its own scrolling
 * to the focused box, which can leave it behind the buttons.
 */
function useKeyboardOffset(
  input: React.RefObject<HTMLInputElement | null>,
  actions: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const timers: number[] = [];
    const measure = () => {
      const hidden = Math.max(
        0,
        Math.round(root.clientHeight - (viewport.offsetTop + viewport.height)),
      );
      root.style.setProperty("--keyboard", `${hidden}px`);
      root.toggleAttribute("data-keyboard-open", hidden > 0);
    };
    const fix = () => {
      if (document.activeElement === input.current) keepVisible(input.current, actions.current);
    };
    const onResize = () => {
      measure();
      fix();
      timers.push(window.setTimeout(fix, 150), window.setTimeout(fix, 400));
    };
    measure();
    viewport.addEventListener("resize", onResize);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", onResize);
      viewport.removeEventListener("scroll", measure);
      timers.forEach(clearTimeout);
      root.style.removeProperty("--keyboard");
      root.removeAttribute("data-keyboard-open");
    };
  }, [input, actions]);
}
