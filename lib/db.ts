import "server-only";
import { Pool } from "pg";
import type { Progress } from "./session";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const hasDatabase = Boolean(connectionString);

// Reused across hot reloads in dev and across requests in one serverless instance.
const store = globalThis as unknown as { kotobaPool?: Pool };

function pool(): Pool {
  store.kotobaPool ??= new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  return store.kotobaPool;
}

export type Attempt = { id: string; wordId: string; answer: string; correct: boolean };

/**
 * Saves an answer. The id comes from the browser, so a retry can't double-count,
 * and "Count as correct" just sends the same id again with correct = true.
 */
export async function saveAttempt({ id, wordId, answer, correct }: Attempt): Promise<void> {
  await pool().query(
    `INSERT INTO attempts (id, word_id, answer, correct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET correct = attempts.correct OR EXCLUDED.correct`,
    [id, wordId, answer, correct],
  );
}

export async function loadProgress(): Promise<Progress> {
  const { rows } = await pool().query<{
    word_id: string;
    attempts: number;
    correct: number;
    streak: number;
    last_seen: Date;
  }>(
    `WITH last_wrong AS (
       SELECT word_id, max(created_at) FILTER (WHERE NOT correct) AS at
       FROM attempts GROUP BY word_id
     )
     SELECT a.word_id,
            count(*)::int AS attempts,
            (count(*) FILTER (WHERE a.correct))::int AS correct,
            (count(*) FILTER (WHERE a.correct AND (lw.at IS NULL OR a.created_at > lw.at)))::int AS streak,
            max(a.created_at) AS last_seen
     FROM attempts a JOIN last_wrong lw USING (word_id)
     GROUP BY a.word_id, lw.at`,
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.word_id,
      {
        attempts: r.attempts,
        correct: r.correct,
        streak: r.streak,
        lastSeen: r.last_seen.toISOString(),
      },
    ]),
  );
}

export type CardStats = {
  attempts: number;
  correct: number;
  /** Times "I don't know" was pressed. */
  gaveUp: number;
  /** Right answers in a row, up to and including the latest attempt. */
  streak: number;
  firstSeen: string;
  lastSeen: string;
};

export type DayStats = { day: string; attempts: number; correct: number };

export type Mistake = { wordId: string; answer: string; times: number; last: string };

export type StatsData = {
  cards: Record<string, CardStats>;
  /** One entry per day with answers, as YYYY-MM-DD in the viewer's time zone, oldest first. */
  days: DayStats[];
  /** Answers given in each hour of the day, 0 to 23, in the viewer's time zone. */
  hours: number[];
  /** Wrong answers typed more than once count once per time typed. */
  mistakes: Mistake[];
  /** Runs of answers with no gap over 30 minutes. */
  sessions: number;
  /** Gaps of up to 5 minutes between answers, added up. An estimate of time spent. */
  secondsStudied: number;
};

/** Everything the stats page shows. `timeZone` decides where one day ends and the next begins. */
export async function loadStats(timeZone: string): Promise<StatsData> {
  const db = pool();
  const [cards, days, hours, mistakes, time] = await Promise.all([
    db.query<{
      word_id: string;
      attempts: number;
      correct: number;
      gave_up: number;
      streak: number;
      first_seen: Date;
      last_seen: Date;
    }>(
      `WITH last_wrong AS (
         SELECT word_id, max(created_at) FILTER (WHERE NOT correct) AS at
         FROM attempts GROUP BY word_id
       )
       SELECT a.word_id,
              count(*)::int AS attempts,
              (count(*) FILTER (WHERE a.correct))::int AS correct,
              (count(*) FILTER (WHERE a.answer = ''))::int AS gave_up,
              (count(*) FILTER (WHERE a.correct AND (lw.at IS NULL OR a.created_at > lw.at)))::int AS streak,
              min(a.created_at) AS first_seen,
              max(a.created_at) AS last_seen
       FROM attempts a JOIN last_wrong lw USING (word_id)
       GROUP BY a.word_id, lw.at`,
    ),
    db.query<{ day: string; attempts: number; correct: number }>(
      `SELECT to_char(created_at AT TIME ZONE $1, 'YYYY-MM-DD') AS day,
              count(*)::int AS attempts,
              (count(*) FILTER (WHERE correct))::int AS correct
       FROM attempts GROUP BY 1 ORDER BY 1`,
      [timeZone],
    ),
    db.query<{ hour: number; n: number }>(
      `SELECT extract(hour FROM created_at AT TIME ZONE $1)::int AS hour, count(*)::int AS n
       FROM attempts GROUP BY 1`,
      [timeZone],
    ),
    db.query<{ word_id: string; answer: string; times: number; last: Date }>(
      `SELECT word_id, lower(btrim(answer)) AS answer, count(*)::int AS times, max(created_at) AS last
       FROM attempts
       WHERE NOT correct AND btrim(answer) <> ''
       GROUP BY 1, 2
       HAVING count(*) > 1
       ORDER BY times DESC, last DESC
       LIMIT 50`,
    ),
    db.query<{ sessions: number; seconds: number }>(
      `WITH t AS (SELECT created_at - lag(created_at) OVER (ORDER BY created_at) AS gap FROM attempts)
       SELECT (count(*) FILTER (WHERE gap IS NULL OR gap > interval '30 minutes'))::int AS sessions,
              coalesce(extract(epoch FROM sum(gap) FILTER (WHERE gap <= interval '5 minutes')), 0)::float AS seconds
       FROM t`,
    ),
  ]);

  const hourCounts = new Array<number>(24).fill(0);
  for (const r of hours.rows) hourCounts[r.hour] = r.n;
  const totals = time.rows[0];

  return {
    cards: Object.fromEntries(
      cards.rows.map((r) => [
        r.word_id,
        {
          attempts: r.attempts,
          correct: r.correct,
          gaveUp: r.gave_up,
          streak: r.streak,
          firstSeen: r.first_seen.toISOString(),
          lastSeen: r.last_seen.toISOString(),
        },
      ]),
    ),
    days: days.rows,
    hours: hourCounts,
    mistakes: mistakes.rows.map((r) => ({
      wordId: r.word_id,
      answer: r.answer,
      times: r.times,
      last: r.last.toISOString(),
    })),
    // With no answers at all, the gap query still returns one row that counts as a session.
    sessions: cards.rows.length ? totals.sessions : 0,
    secondsStudied: Math.round(totals.seconds),
  };
}
