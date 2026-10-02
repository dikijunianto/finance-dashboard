import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
const url = new URL(process.env.QA_DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
  /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname),
);
const name = "myfinance_qa_migration_" + randomUUID().replaceAll("-", "");
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.href);
let sql;
try {
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  const testUrl = new URL(url);
  testUrl.pathname = "/" + name;
  sql = postgres(testUrl.href);
  for (const file of [
    "0000_tricky_galactus",
    "0001_keen_diamondback",
    "0002_familiar_spyke",
  ]) {
    const migration = await readFile(
      "src/db/migrations/" + file + ".sql",
      "utf8",
    );
    await sql.begin((tx) => tx.unsafe(migration));
  }
  const [owner] =
    await sql`insert into "user"(email) values('migration@qa.local') returning id`;
  const ids = [];
  for (const [balance, active] of [
    [5000000, true],
    [-25000, true],
    [0, false],
  ]) {
    const [a] =
      await sql`insert into finance_accounts(user_id,name,type,balance,is_active) values(${owner.id},'Legacy account','bank',${balance},${active}) returning id`;
    ids.push(a.id);
  }
  await sql`insert into income(user_id,account_id,source,amount,received_at) values(${owner.id},${ids[0]},'Old salary',10000000,'2026-01-01')`;
  await sql`insert into expenses(user_id,description,category,amount,spent_at) values(${owner.id},'Old expense','living',250000,'2026-01-01')`;
  const [bill] =
    await sql`insert into bills(user_id,name,category,amount,due_day,frequency) values(${owner.id},'Old bill','utilities',100,1,'monthly') returning id`;
  await sql`insert into bill_payments(user_id,bill_id,billing_month,amount,due_date,status) values(${owner.id},${bill.id},'2026-01-01',100,'2026-01-01','paid')`;
  const [debt] =
    await sql`insert into debts(user_id,name,lender,debt_type,original_amount,remaining_amount,installment_amount,due_day) values(${owner.id},'Old debt','QA','other',1000,500,100,1) returning id`;
  await sql`insert into debt_payments(user_id,debt_id,amount,paid_at) values(${owner.id},${debt.id},500,'2026-01-01')`;
  const tables = [
    "finance_accounts",
    "income",
    "expenses",
    "bill_payments",
    "debt_payments",
  ];
  const before = {};
  for (const table of tables)
    before[table] = await sql.unsafe(`select * from "${table}" order by id`);
  const migration = await readFile(
    "src/db/migrations/0003_account_movements.sql",
    "utf8",
  );
  await sql.begin((tx) => tx.unsafe(migration));
  for (const table of tables) {
    const after = await sql.unsafe(`select * from "${table}" order by id`);
    assert.deepEqual(
      after.map(({ account_id, ...row }) =>
        table.endsWith("payments") ? row : { ...row, account_id },
      ),
      before[table].map(({ account_id, ...row }) =>
        table.endsWith("payments") ? row : { ...row, account_id },
      ),
    );
    if (table.endsWith("payments"))
      assert(after.every((p) => p.account_id === null));
  }
  assert.equal(
    (await sql`select count(*)::int n from account_movements`)[0].n,
    3,
  );
  assert.equal(
    (
      await sql`select a.id from finance_accounts a join account_movements m on m.account_id=a.id where m.type != 'opening_balance' or m.amount != a.balance`
    ).length,
    0,
  );
  console.log(
    "PASS migration: populated legacy balances, overdrafts, inactive accounts, transaction links and payment history preserved; one exact baseline per account.",
  );
  await sql`insert into income(user_id,source,amount,received_at) values(${owner.id},'End month',10000000,'2026-09-30'),(${owner.id},'Leap date',100000,'2028-02-29')`;
  const v11 = {};
  for (const table of [...tables, "bills", "debts", "account_movements"])
    v11[table] = await sql.unsafe(`select * from "${table}" order by id`);
  await sql.begin(async (tx) =>
    tx.unsafe(
      await readFile("src/db/migrations/0004_smart_timeslip.sql", "utf8"),
    ),
  );
  for (const table of Object.keys(v11)) {
    const after = await sql.unsafe(`select * from "${table}" order by id`);
    assert.deepEqual(
      after.map((row) => {
        const copy = { ...row };
        if (table === "income") delete copy.funding_month;
        return copy;
      }),
      v11[table].map(row => ({ ...row })),
    );
  }
  const funding =
    await sql`select received_at::text, funding_month::text from income order by received_at`;
  assert.deepEqual(
    funding.map((x) => x.funding_month),
    ["2026-01-01", "2026-09-01", "2028-02-01"],
  );
  console.log(
    "PASS migration 0004: only funding metadata backfilled from actual month; income history, accounts, ledger and payments unchanged.",
  );
  for (const category of ['Living', 'Makan', 'Kebutuhan', 'food', 'entertainment', 'investments', 'saving', 'buffer', 'Give', 'Style', 'paket si mamah'])
    await sql`insert into expenses(user_id,description,category,amount,spent_at) values(${owner.id},${category},${category},100,'2026-10-02')`;
  const [investment] = await sql`insert into finance_accounts(user_id,name,type,balance) values(${owner.id},'Investment','investment',0) returning id`;
  const transferId = randomUUID(), reversedId = randomUUID();
  for (const id of [transferId, reversedId]) {
    await sql`insert into account_movements(user_id,account_id,type,amount,reference_type,reference_id,description,occurred_at) values
      (${owner.id},${ids[0]},'transfer_out',-5000000,'transfer',${id},'Investment','2026-10-01'),
      (${owner.id},${investment.id},'transfer_in',5000000,'transfer',${id},'Investment','2026-10-01')`;
  }
  await sql`insert into account_movements(user_id,account_id,type,amount,reference_type,reference_id,description,occurred_at) values(${owner.id},${ids[0]},'reversal',5000000,'transfer',${reversedId},'Reverted','2026-11-01')`;
  const v12 = {};
  for (const table of [...tables, 'bills', 'debts', 'account_movements']) v12[table] = await sql.unsafe(`select * from "${table}" order by id`);
  await sql.begin(async tx => tx.unsafe(await readFile('src/db/migrations/0005_last_darkhawk.sql', 'utf8')));
  for (const table of Object.keys(v12)) {
    const after = await sql.unsafe(`select * from "${table}" order by id`);
    assert.deepEqual(after.map(row => { const copy = { ...row }; if (table === 'expenses') delete copy.plan_category; return copy; }), v12[table].map(row => ({ ...row })));
  }
  const mapped = await sql`select category,plan_category from expenses`;
  for (const category of ['Living', 'Makan', 'Kebutuhan', 'food']) assert.equal(mapped.find(r => r.category === category).plan_category, 'living');
  for (const category of ['Give', 'Style', 'paket si mamah']) assert.equal(mapped.find(r => r.category === category).plan_category, null);
  const attributed = await sql`select id,plan_category from transfer_plan_attributions`;
  assert.deepEqual(attributed.map(r => ({ ...r })), [{ id: transferId, plan_category: 'investments' }]);
  // Metadata backfill retry leaves financial rows unchanged and creates no duplicate attribution.
  const attributionMigration = await readFile('src/db/migrations/0005_last_darkhawk.sql', 'utf8');
  await sql.begin(tx => tx.unsafe(attributionMigration.slice(attributionMigration.indexOf('-- Preserve'))));
  assert.equal((await sql`select count(*)::int n from transfer_plan_attributions`)[0].n, 1);
  console.log('PASS migration 0005: exact mapping, ambiguous NULLs, logical investment attribution/reversal exclusion; all financial rows unchanged; backfill retry safe. Rollback is old-code compatible because legacy columns remain.');
} finally {
  if (sql) await sql.end();
  assert(/^myfinance_qa_migration_[a-f0-9]{32}$/.test(name));
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
}
