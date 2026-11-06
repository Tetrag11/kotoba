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
