"use client";

import { useRef, useState } from "react";
import {
  LEARNED_STREAK,
  missedIds,
  pickWords,
  sessionScore,
  startSession,
  statusOf,
  type Progress,
  type Session,
} from "@/lib/session";
import type { Word } from "@/lib/words";
import { Quiz } from "./Quiz";
import { WordGrid } from "./WordGrid";

const SIZES = [10, 20, 50];

type Storage = "ok" | "none" | "error";
type Attempt = { id: string; wordId: string; answer: string; correct: boolean };

async function postAttempt(attempt: Attempt): Promise<boolean> {
  for (let tries = 0; tries < 2; tries++) {
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
        keepalive: true,
      });
      if (res.ok) return true;
    } catch {
      // Network failure: fall through to the retry.
    }
  }
  return false;
}

export function Study({
  words,
  initialProgress,
  storage,
}: {
  words: Word[];
  initialProgress: Progress;
  storage: Storage;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [size, setSize] = useState(20);
  const [session, setSession] = useState<Session | null>(null);
  const [finished, setFinished] = useState<Session | null>(null);
  const [unsaved, setUnsaved] = useState(0);
  const pending = useRef(new Set<Promise<boolean>>());
  const byId = new Map(words.map((w) => [w.id, w]));

  function save(attempt: Attempt) {
    if (storage === "none") return;
    const request = postAttempt(attempt);
    pending.current.add(request);
    request.then((saved) => {
      pending.current.delete(request);
      if (!saved) setUnsaved((n) => n + 1);
    });
  }

  function start() {
    setFinished(null);
    setUnsaved(0);
    setSession(startSession(pickWords(words, progress, size)));
  }

  async function finish(result: Session) {
    setSession(null);
    // Ending before answering anything leaves nothing to report.
    setFinished(result.turn > 0 ? result : null);
    if (storage === "none") return;
    await Promise.all(pending.current);
    try {
      const res = await fetch("/api/progress");
      if (res.ok) setProgress((await res.json()).progress);
    } catch {
      // The home sheet keeps showing the last progress it loaded.
    }
  }

  if (session) {
    return (
      <Quiz
        key={session.turn}
        session={session}
        byId={byId}
        onChange={setSession}
        onFinish={finish}
        onSave={save}
      />
    );
  }

  const counts = { new: 0, learning: 0, learned: 0 };
  for (const w of words) counts[statusOf(progress[w.id])]++;
  const sessionSize = Math.min(size, words.length);

  return (
    <main className="sheet">
      <header className="masthead">
        <h1 lang="ja">ことば</h1>
        <p>JLPT N5 vocabulary, pages 1 to 11</p>
      </header>

      {storage === "none" && (
        <p className="notice">
          Your progress isn’t being saved yet. Add a database in Vercel, then redeploy.
        </p>
      )}
      {storage === "error" && (
        <p className="notice">
          The database can’t be reached, so your earlier progress isn’t showing. You can still
          study, but answers may not save.
        </p>
      )}

      {finished && <Summary session={finished} byId={byId} unsaved={unsaved} />}

      <section className="start" aria-label="Start studying">
        <fieldset className="sizes">
          <legend>Words per session</legend>
          {SIZES.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="size"
                value={n}
                checked={size === n}
                onChange={() => setSize(n)}
              />
              <span>{n}</span>
            </label>
          ))}
        </fieldset>
        <button className="primary" onClick={start}>
          Start {sessionSize} words
        </button>
      </section>

      <section aria-label="Your progress">
        <WordGrid words={words} progress={progress} />
        <ul className="legend">
          <li>
            <span className="swatch swatch-new" /> {counts.new} new
          </li>
          <li>
            <span className="swatch swatch-learning" /> {counts.learning} learning
          </li>
          <li>
            <span className="swatch swatch-learned" /> {counts.learned} learned
          </li>
        </ul>
        <p className="hint">A word is learned after {LEARNED_STREAK} right answers in a row.</p>
      </section>
    </main>
  );
}

function Summary({
  session,
  byId,
  unsaved,
}: {
  session: Session;
  byId: Map<string, Word>;
  unsaved: number;
}) {
  const missed = missedIds(session);
  const { right, tried } = sessionScore(session);
  return (
    <section className="summary" aria-label="Session results">
      <h2>
        {right} of {tried} right first time
      </h2>
      {unsaved > 0 && (
        <p className="notice">
          {unsaved} {unsaved === 1 ? "answer" : "answers"} didn’t save. Check your connection before
          your next session.
        </p>
      )}
      {missed.length > 0 && (
        <>
          <p className="hint">These come back sooner next time.</p>
          <ul className="missed">
            {missed.map((id) => {
              const word = byId.get(id)!;
              return (
                <li key={id}>
                  <span lang="ja" className="missed-word">
                    {word.kanji || word.kana}
                  </span>
                  <span lang="ja" className="missed-kana">
                    {word.kanji ? word.kana : ""}
                  </span>
                  <span>{word.english}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
