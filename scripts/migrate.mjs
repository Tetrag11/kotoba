// Applies any new files in migrations/, in filename order. Runs before every build.
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.log("migrate: no DATABASE_URL set, skipping. Progress won't be saved.");
  process.exit(0);
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  await client.query("BEGIN");
  // Stops two deployments migrating at once. Released on commit.
  await client.query("SELECT pg_advisory_xact_lock(727001)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const dir = new URL("../migrations/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await client.query(await readFile(new URL(file, dir), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    console.log(`migrate: applied ${file}`);
  }
  await client.query("COMMIT");
  console.log("migrate: database is up to date");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`migrate: failed: ${err.message || err.code}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
