import { readFile } from "node:fs/promises";
import pg from "pg";

// Rehearse by default. Applying is an explicit pre-deployment operation.
const apply = process.argv.includes("--apply");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  await connection.query("SET LOCAL lock_timeout = '10s'");
  await connection.query("SET LOCAL statement_timeout = '120s'");
  await connection.query("SELECT pg_advisory_xact_lock(843721, 2)");
  // Snapshot row counts under table locks. Never delete, backfill or replace
  // existing records; abort if either migration changes any existing count.
  const tables = await connection.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const counts = new Map();
  for (const { tablename } of tables.rows) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    await connection.query(`LOCK TABLE public.${quoted} IN SHARE MODE`);
    const result = await connection.query(`SELECT count(*)::text AS count FROM public.${quoted}`);
    counts.set(quoted, result.rows[0].count);
  }
  for (const filename of ["stage-b-media-assets.sql", "stage-b-media-verification-jobs.sql"]) {
    const sql = await readFile(new URL(`../migrations/${filename}`, import.meta.url), "utf8");
    // Only remove the outer transaction; retain the DO block's BEGIN.
    await connection.query(sql.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, ""));
  }
  for (const [quoted, before] of counts) {
    const result = await connection.query(`SELECT count(*)::text AS count FROM public.${quoted}`);
    if (result.rows[0].count !== before) throw new Error("Existing table row count changed; refusing migration");
  }
  await connection.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(`Stage B migration ${apply ? "applied" : "rehearsed and rolled back"}; ${counts.size} existing table counts preserved`);
} catch (error) {
  await connection.query("ROLLBACK");
  // Do not print connection strings or provider errors containing secrets.
  console.error("Stage B migration failed and rolled back");
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
