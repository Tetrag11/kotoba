"use client";

import { useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { CardStats, StatsData } from "@/lib/db";
import { decks, type DeckId } from "@/lib/decks";
import { LEARNED_STREAK } from "@/lib/session";
import { words } from "@/lib/words";
import {
  accuracy,
  calendarWeeks,
  cardRows,
  daysBetween,
  dayStreaks,
  formatAgo,
  formatDuration,
  hardest,
  intensity,
  localDay,
  longestUnseen,
  nearlyLearned,
  recentDays,
  repeatedMistakes,
  sortRows,
  statusCounts,
  type CardRow,
  type SortKey,
} from "@/lib/stats";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; data: StatsData };
type Tip = { text: string; x: number; y: number } | null;
type ShowTip = (event: PointerEvent, text: string) => void;

const DECK_IDS: DeckId[] = ["words", "kanji"];
/** The calendar covers your whole history, between these sizes. */
const MIN_WEEKS = 12;
const MAX_WEEKS = 26;
const number = new Intl.NumberFormat("en");
const percent = (n: number) => `${Math.round(n * 100)}%`;
const times = (n: number) => `${number.format(n)} ${n === 1 ? "time" : "times"}`;

function dayLabel(day: string, style: "long" | "short" = "long"): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style === "long" ? "short" : undefined,
    day: "numeric",
    month: "short",
  });
}

function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

export function Stats({ hasDatabase, initialDeck }: { hasDatabase: boolean; initialDeck: DeckId }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [deckId, setDeckId] = useState(initialDeck);
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    if (!hasDatabase) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/stats?tz=${encodeURIComponent(tz)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: StatsData) => setLoad({ state: "ready", data }))
      .catch(() => setLoad({ state: "error" }));
  }, [hasDatabase]);

  function chooseDeck(next: DeckId) {
    setDeckId(next);
    window.history.replaceState(null, "", next === "kanji" ? "/stats?deck=kanji" : "/stats");
  }

  const showTip: ShowTip = (event, text) => setTip({ text, x: event.clientX, y: event.clientY });
  const hideTip = () => setTip(null);

  return (
    <main className="sheet stats" onPointerLeave={hideTip}>
      <header className="masthead">
        <a className="text-link" href={deckId === "kanji" ? "/?deck=kanji" : "/"}>
          Back to studying
        </a>
        <h1 lang="ja">きろく</h1>
        <p>Your stats</p>
      </header>

      {!hasDatabase && (
        <p className="notice">
          Stats need a database to read your answers from. Add one in Vercel, then redeploy.
        </p>
      )}
      {hasDatabase && load.state === "loading" && <p className="hint">Loading your stats…</p>}
      {load.state === "error" && hasDatabase && (
        <p className="notice">Your stats couldn’t be loaded. Check your connection and refresh.</p>
      )}

      {load.state === "ready" && (
        <Report
          data={load.data}
          deckId={deckId}
          chooseDeck={chooseDeck}
          showTip={showTip}
          hideTip={hideTip}
        />
      )}

      {tip && (
        <div className="tooltip" role="presentation" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </main>
  );
}

function Report({
  data,
  deckId,
  chooseDeck,
  showTip,
  hideTip,
}: {
  data: StatsData;
  deckId: DeckId;
  chooseDeck: (id: DeckId) => void;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const today = localDay();
  const totals = data.days.reduce(
    (t, d) => ({ attempts: t.attempts + d.attempts, correct: t.correct + d.correct }),
    { attempts: 0, correct: 0 },
  );
  const streaks = dayStreaks(
    data.days.map((d) => d.day),
    today,
  );
  const learned = (id: DeckId) => statusCounts(cardRows(decks[id].cards, data.cards)).learned;
  const tipProps = { showTip, hideTip };

  return (
    <>
      {totals.attempts === 0 ? (
        <p className="summary-line">
          Nothing to show yet. Answer a few words and your stats will start filling in.
        </p>
      ) : (
        <section aria-label="Summary" className="summary-block">
          <p className="summary-line">
            You’ve answered {times(totals.attempts)} over {number.format(data.days.length)}{" "}
            {data.days.length === 1 ? "day" : "days"}, and got{" "}
            {percent(totals.correct / totals.attempts)} right.
          </p>
          <dl className="figures">
            <Figure label="Day streak" value={number.format(streaks.current)}>
              Best: {number.format(streaks.longest)}
            </Figure>
            <Figure
              label="Time studied"
              value={formatDuration(data.secondsStudied).replace(/^about /, "")}
            >
              About, across {number.format(data.sessions)}{" "}
              {data.sessions === 1 ? "session" : "sessions"}
            </Figure>
            <Figure label="Words learned" value={number.format(learned("words"))}>
              of {decks.words.cards.length}
            </Figure>
            <Figure label="Kanji learned" value={number.format(learned("kanji"))}>
              of {decks.kanji.cards.length}
            </Figure>
          </dl>
        </section>
      )}

      {totals.attempts > 0 && (
        <>
          <Calendar data={data} today={today} {...tipProps} />
          <RecentDays data={data} today={today} {...tipProps} />
          <Hours hours={data.hours} {...tipProps} />
        </>
      )}

      <div className="deck-switch">
        <h2>Your {decks[deckId].plural}</h2>
        <fieldset className="choice">
          <legend className="visually-hidden">Which stats to show</legend>
          {DECK_IDS.map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="stats-deck"
                checked={deckId === id}
                onChange={() => chooseDeck(id)}
              />
              <span>{decks[id].label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <DeckReport key={deckId} deckId={deckId} data={data} today={today} {...tipProps} />
    </>
  );
}

function Figure({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className="figure">{value}</span>
        <span className="hint">{children}</span>
      </dd>
    </div>
  );
}

function Calendar({
  data,
  today,
  showTip,
  hideTip,
}: {
  data: StatsData;
  today: string;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const first = data.days[0]?.day ?? today;
  const count = Math.min(
    MAX_WEEKS,
    Math.max(MIN_WEEKS, Math.ceil((daysBetween(first, today) + 1) / 7) + 1),
  );
  const weeks = calendarWeeks(data.days, today, count);
  const shown = weeks.flat();
  const busiest = Math.max(0, ...shown.map((d) => d.attempts));
  const top = shown.reduce((a, b) => (b.attempts > a.attempts ? b : a));
  const studied = shown.filter((d) => d.attempts > 0).length;
  const months = weeks.map((w, i) => {
    const first = w.find((d) => d.day.endsWith("-01")) ?? (i === 0 ? w[0] : undefined);
    return first
      ? new Date(`${first.day}T00:00:00Z`).toLocaleDateString("en-GB", {
          timeZone: "UTC",
          month: "short",
        })
      : "";
  });
  // A label needs a couple of columns to itself, or it runs into the next one.
  months.forEach((m, i) => {
    if (m && months.slice(i + 1, i + 3).some(Boolean)) months[i] = "";
  });

  return (
    <section className="chart-block" aria-labelledby="activity-title">
      <h2 id="activity-title">Activity</h2>
      <p className="hint">
        {studied === 0
          ? `No answers in the last ${count} weeks.`
          : `You studied on ${studied} of the last ${count * 7} days. Busiest: ${dayLabel(top.day)}, with ${number.format(top.attempts)} ${top.attempts === 1 ? "answer" : "answers"}.`}
      </p>
      <div className="calendar" style={{ "--weeks": count } as React.CSSProperties}>
        <div className="calendar-months" aria-hidden="true">
          {months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className="calendar-days" aria-hidden="true">
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
          <span />
        </div>
        <div className="calendar-grid" role="list" aria-label="Answers per day">
          {weeks.map((week, w) =>
            week.map((d, i) => {
              const text = d.future
                ? ""
                : d.attempts === 0
                  ? `${dayLabel(d.day)}: no answers`
                  : `${dayLabel(d.day)}: ${number.format(d.attempts)} answers, ${percent(d.correct / d.attempts)} right`;
              return (
                <span
                  key={d.day}
                  role="listitem"
                  aria-label={text || undefined}
                  className={`heat heat-${intensity(d.attempts, busiest)}${d.future ? " heat-future" : ""}${d.day === today ? " heat-today" : ""}`}
                  style={{ gridColumn: w + 1, gridRow: i + 1 }}
                  onPointerMove={text ? (e) => showTip(e, text) : undefined}
                  onPointerLeave={hideTip}
                />
              );
            }),
          )}
        </div>
      </div>
      <div className="scale" aria-hidden="true">
        <span className="hint">Fewer</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className={`heat heat-${n}`} />
        ))}
        <span className="hint">More</span>
      </div>
    </section>
  );
}

function RecentDays({
  data,
  today,
  showTip,
  hideTip,
}: {
  data: StatsData;
  today: string;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const days = recentDays(data.days, today, 14);
  const most = Math.max(1, ...days.map((d) => d.attempts));
  return (
    <section className="chart-block" aria-labelledby="recent-title">
      <h2 id="recent-title">Last two weeks</h2>
      <ul className="legend" aria-hidden="true">
        <li>
          <span className="swatch swatch-right" /> Right
        </li>
        <li>
          <span className="swatch swatch-wrong" /> Wrong
        </li>
      </ul>
      <div className="bars" role="list" aria-label="Answers per day, last two weeks">
        <span className="bars-max" aria-hidden="true">
          {number.format(most)}
        </span>
        {days.map((d) => {
          const wrong = d.attempts - d.correct;
          const text =
            d.attempts === 0
              ? `${dayLabel(d.day)}: no answers`
              : `${dayLabel(d.day)}: ${number.format(d.correct)} right, ${number.format(wrong)} wrong`;
          return (
            <div
              key={d.day}
              className="bar-col"
              role="listitem"
              aria-label={text}
              onPointerMove={(e) => showTip(e, text)}
              onPointerLeave={hideTip}
            >
              <div className="bar-stack">
                {wrong > 0 && (
                  <span className="seg seg-wrong" style={{ height: `${(wrong / most) * 100}%` }} />
                )}
                {d.correct > 0 && (
                  <span
                    className="seg seg-right"
                    style={{ height: `${(d.correct / most) * 100}%` }}
                  />
                )}
              </div>
              <span className={`bar-label${d.day === today ? " is-today" : ""}`} aria-hidden="true">
                {Number(d.day.slice(8))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Hours({
  hours,
  showTip,
  hideTip,
}: {
  hours: number[];
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const most = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  return (
    <section className="chart-block" aria-labelledby="hours-title">
      <h2 id="hours-title">Time of day</h2>
      <p className="hint">
        You study most between {hourLabel(peak)} and {hourLabel((peak + 1) % 24)}.
      </p>
      <div className="bars bars-hours" role="list" aria-label="Answers by hour of the day">
        {hours.map((n, h) => {
          const text = `${hourLabel(h)} to ${hourLabel((h + 1) % 24)}: ${number.format(n)} answers`;
          return (
            <div
              key={h}
              className="bar-col"
              role="listitem"
              aria-label={text}
              onPointerMove={(e) => showTip(e, text)}
              onPointerLeave={hideTip}
            >
              <div className="bar-stack">
                {n > 0 && (
                  <span className="seg seg-hour" style={{ height: `${(n / most) * 100}%` }} />
                )}
              </div>
              <span className="bar-label" aria-hidden="true">
                {h % 6 === 0 ? hourLabel(h) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeckReport({
  deckId,
  data,
  today,
  showTip,
  hideTip,
}: {
  deckId: DeckId;
  data: StatsData;
  today: string;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const deck = decks[deckId];
  const rows = useMemo(() => cardRows(deck.cards, data.cards), [deck, data]);
  const counts = statusCounts(rows);
  const seenDay = (s: CardStats) => localDay(new Date(s.lastSeen));
  const hard = hardest(rows, 8);
  const nearly = nearlyLearned(rows, 8);
  const stale = longestUnseen(rows, 8);
  const mistakes = repeatedMistakes(data.mistakes, rows, 8);
  const most = sortRows(rows, "most")
    .filter((r) => r.stats)
    .slice(0, 8);

  return (
    <>
      <section className="chart-block" aria-label={`${deck.label} progress`}>
        <StatusBar counts={counts} total={rows.length} showTip={showTip} hideTip={hideTip} />
        <ul className="legend">
          <li>
            <span className="swatch swatch-learned" /> {counts.learned} learned
          </li>
          <li>
            <span className="swatch swatch-learning" /> {counts.learning} learning
          </li>
          <li>
            <span className="swatch swatch-new" /> {counts.new} not started
          </li>
        </ul>
        {deckId === "words" && <ByPage rows={rows} showTip={showTip} hideTip={hideTip} />}
      </section>

      <div className="lists">
        <CardList
          title="Hardest"
          empty={`${deck.label} you miss will show up here.`}
          rows={hard}
          detail={(r) => `${percent(accuracy(r.stats)!)} right of ${r.stats!.attempts}`}
        />
        <CardList
          title="One more right answer to learn"
          empty={`Nothing is ${LEARNED_STREAK - 1} right answers in.`}
          rows={nearly}
          detail={(r) => `last seen ${formatAgo(seenDay(r.stats!), today)}`}
        />
        <CardList
          title="Learned, but not seen lately"
          empty={`Learned ${deck.plural} will show up here.`}
          rows={stale}
          detail={(r) => `last seen ${formatAgo(seenDay(r.stats!), today)}`}
        />
        <CardList
          title="Seen most"
          empty="Nothing seen yet."
          rows={most}
          detail={(r) => times(r.stats!.attempts)}
        />
        <section className="card-list">
          <h3>Wrong answers you repeat</h3>
          {mistakes.length === 0 ? (
            <p className="hint">The same wrong answer typed twice shows up here.</p>
          ) : (
            <ul className="rows">
              {mistakes.map((m) => (
                <li key={m.wordId + m.answer}>
                  <span lang="ja" className="row-word">
                    {m.card.prompt}
                  </span>
                  <span className="row-detail">
                    You typed “{m.answer}” {times(m.times)}
                  </span>
                  <span className="row-meaning">It means {m.card.english}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AllCards key={deckId} rows={rows} counts={counts} plural={deck.plural} today={today} />
    </>
  );
}

function StatusBar({
  counts,
  total,
  showTip,
  hideTip,
  thin = false,
}: {
  counts: { new: number; learning: number; learned: number };
  total: number;
  showTip: ShowTip;
  hideTip: () => void;
  thin?: boolean;
}) {
  const parts = [
    ["learned", counts.learned, "learned"],
    ["learning", counts.learning, "learning"],
    ["new", counts.new, "not started"],
  ] as const;
  return (
    <div
      className={`status-bar${thin ? " thin" : ""}`}
      role="img"
      aria-label={parts.map(([, n, l]) => `${n} ${l}`).join(", ")}
    >
      {parts.map(([key, n, label]) =>
        n > 0 ? (
          <span
            key={key}
            className={`status status-${key}`}
            style={{ flexGrow: n }}
            onPointerMove={(e) => showTip(e, `${n} of ${total} ${label}`)}
            onPointerLeave={hideTip}
          />
        ) : null,
      )}
    </div>
  );
}

function ByPage({
  rows,
  showTip,
  hideTip,
}: {
  rows: CardRow[];
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const pages = [...new Set(rows.map((r) => pageById.get(r.id)))].filter(
    (p): p is number => p !== undefined,
  );
  return (
    <div className="by-page">
      <h3>By page of the list</h3>
      <ul>
        {pages.map((page) => {
          const onPage = rows.filter((r) => pageById.get(r.id) === page);
          const c = statusCounts(onPage);
          return (
            <li key={page}>
              <span className="hint">Page {page}</span>
              <StatusBar
                counts={c}
                total={onPage.length}
                showTip={showTip}
                hideTip={hideTip}
                thin
              />
              <span className="hint">
                {c.learned} of {onPage.length}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The page of the PDF each word came from. */
const pageById = new Map(words.map((w) => [w.id, w.page]));

function CardList({
  title,
  empty,
  rows,
  detail,
}: {
  title: string;
  empty: string;
  rows: CardRow[];
  detail: (row: CardRow) => string;
}) {
  return (
    <section className="card-list">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="hint">{empty}</p>
      ) : (
        <ul className="rows">
          {rows.map((r) => (
            <li key={r.id}>
              <span lang="ja" className="row-word">
                {r.prompt}
              </span>
              <span className="row-detail">{detail(r)}</span>
              <span className="row-meaning">{r.english}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const FILTERS = [
  ["all", "All"],
  ["new", "Not started"],
  ["learning", "Learning"],
  ["learned", "Learned"],
] as const;

const SORTS: [SortKey, string][] = [
  ["list", "List order"],
  ["most", "Seen most"],
  ["least", "Seen least"],
  ["accuracy", "Lowest accuracy"],
  ["recent", "Seen most recently"],
];

function AllCards({
  rows,
  counts,
  plural,
  today,
}: {
  rows: CardRow[];
  counts: { new: number; learning: number; learned: number };
  plural: string;
  today: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [sort, setSort] = useState<SortKey>("list");
  const shown = sortRows(
    rows.filter((r) => filter === "all" || r.status === filter),
    sort,
  );
  const count = (f: (typeof FILTERS)[number][0]) => (f === "all" ? rows.length : counts[f]);

  return (
    <section className="all-cards" aria-labelledby="all-title">
      <h2 id="all-title">Every {plural === "words" ? "word" : "kanji"}</h2>
      <div className="table-controls">
        <fieldset className="choice choice-small">
          <legend className="visually-hidden">Show</legend>
          {FILTERS.map(([key, label]) => (
            <label key={key}>
              <input
                type="radio"
                name="filter"
                checked={filter === key}
                onChange={() => setFilter(key)}
              />
              <span>
                {label} {count(key)}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="sort">
          <span className="hint">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="hint">No {plural} here yet.</p>
      ) : (
        <table className="card-table">
          <thead>
            <tr>
              <th scope="col">{plural === "words" ? "Word" : "Kanji"}</th>
              <th scope="col">Meaning</th>
              <th scope="col">Seen</th>
              <th scope="col">Right</th>
              <th scope="col">In a row</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const s = r.stats;
              const acc = accuracy(s);
              return (
                <tr key={r.id} className={`row-${r.status}`}>
                  <td className="cell-word">
                    <span lang="ja">{r.prompt}</span>
                    {r.reading && (
                      <span lang="ja" className="hint">
                        {r.reading}
                      </span>
                    )}
                  </td>
                  <td className="cell-meaning">{r.english}</td>
                  <td className="cell-seen" data-label="Seen">
                    {s ? `${number.format(s.attempts)}×` : "–"}
                  </td>
                  <td className="cell-right" data-label="Right">
                    {acc === null ? "–" : percent(acc)}
                  </td>
                  <td className="cell-streak" data-label="In a row">
                    <span
                      className="pips"
                      role="img"
                      aria-label={`${Math.min(s?.streak ?? 0, LEARNED_STREAK)} of ${LEARNED_STREAK} right in a row`}
                    >
                      {Array.from({ length: LEARNED_STREAK }, (_, i) => (
                        <span key={i} className={i < (s?.streak ?? 0) ? "pip on" : "pip"} />
                      ))}
                    </span>
                  </td>
                  <td className="cell-last" data-label="Last seen">
                    {s ? formatAgo(localDay(new Date(s.lastSeen)), today) : "Not started"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
