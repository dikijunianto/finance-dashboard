import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
const url = new URL(process.env.QA_DATABASE_URL);
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname),
  "Only an isolated local QA database is allowed",
);
const sql = postgres(url.href);
try {
  const [row] = await sql`select to_regclass('public.income') as present`;
  if (!row.present)
    for (const file of (await readdir("src/db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await sql.unsafe(await readFile("src/db/migrations/" + file, "utf8"));
    }
  console.log("Isolated local QA schema ready; no existing rows changed.");
} finally {
  await sql.end();
}
