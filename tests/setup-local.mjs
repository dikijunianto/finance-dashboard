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
      const text = await readFile("src/db/migrations/" + file, "utf8");
      await sql.begin((tx) => tx.unsafe(text));
    }
  const [ledger] =
    await sql`select to_regclass('public.account_movements') as present`;
  if (!ledger.present) {
    const before =
      await sql`select id,balance from finance_accounts order by id`;
    const migration = await readFile(
      "src/db/migrations/0003_account_movements.sql",
      "utf8",
    );
    await sql.begin((tx) => tx.unsafe(migration));
    assert.deepEqual(
      await sql`select id,balance from finance_accounts order by id`,
      before,
    );
    const mismatch =
      await sql`select a.id from finance_accounts a left join account_movements m on m.account_id=a.id group by a.id having a.balance != coalesce(sum(m.amount),0)`;
    assert.equal(
      mismatch.length,
      0,
      "Migration baseline preserves ledger and balances",
    );
  }
  const [funding] =
    await sql`select 1 present from information_schema.columns where table_schema='public' and table_name='income' and column_name='funding_month'`;
  if (!funding) {
    const before =
      await sql`select id,balance from finance_accounts order by id`;
    await sql.begin(async (tx) =>
      tx.unsafe(
        await readFile("src/db/migrations/0004_smart_timeslip.sql", "utf8"),
      ),
    );
    assert.deepEqual(
      await sql`select id,balance from finance_accounts order by id`,
      before,
    );
  }
  const [attribution] = await sql`select 1 present from information_schema.columns where table_name='expenses' and column_name='plan_category'`;
  if (!attribution) await sql.begin(async tx => tx.unsafe(await readFile('src/db/migrations/0005_last_darkhawk.sql', 'utf8')));
  console.log("Isolated local QA schema ready; balances preserved.");
} finally {
  await sql.end();
}
