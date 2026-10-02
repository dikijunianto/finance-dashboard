import assert from "node:assert/strict";
import { createRequire } from "node:module";
import postgres from "postgres";
import { rupiah } from "../src/lib/currency.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const url = new URL(process.env.QA_DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname),
);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3005";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const sql = postgres(url.href),
  prefix = "QA-v12browser-" + Date.now();
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const go = async (path) => {
  await page.goto(base + path);
  await page.getByRole("heading", { level: 1 }).waitFor();
};
const button = (name) => page.getByRole("button", { name, exact: true });
const dialog = () => page.getByRole("dialog");
const fill = async (fields) => {
  for (const [name, value] of Object.entries(fields))
    await dialog().getByLabel(name, { exact: true }).fill(String(value));
};
const save = async (name) => {
  await dialog().getByRole("button", { name, exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
};
const metric = async (label) =>
  page
    .locator("section")
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .innerText();
const account = async (suffix) =>
  (await sql`select * from finance_accounts where name=${prefix + suffix}`)[0];
try {
  await go("/login");
  await page.getByLabel("Username").fill("qa-local");
  await page.getByLabel("Password", { exact: true }).fill("qa-local-password");
  await button("Sign In").click();
  await page.waitForURL(base + "/dashboard");
  await go("/accounts");
  for (const [suffix, type] of [
    [" BCA", "bank"],
    [" GoPay", "e_wallet"],
  ]) {
    await button("+ Add Account").first().click();
    await fill({ "Account Name": prefix + suffix, "Current Balance": 0 });
    await dialog().locator('select[name="type"]').selectOption(type);
    await save("Add Account");
  }
  const bank = await account(" BCA"),
    wallet = await account(" GoPay");
  await go("/cash-flow");
  await button("Add Transaction").click();
  await fill({
    Source: prefix + " salary",
    Amount: 10000000,
    Date: "2026-09-24",
  });
  assert.equal(
    await dialog().getByLabel("Use for Plan", { exact: true }).inputValue(),
    "2026-09",
  );
  await fill({ Date: "2026-09-25" });
  assert.equal(
    await dialog().getByLabel("Use for Plan", { exact: true }).inputValue(),
    "2026-10",
  );
  await fill({ Date: "2026-09-30" });
  await dialog()
    .getByLabel("Received To", { exact: true })
    .selectOption(bank.id);
  await save("Save Income");
  await page.reload();
  assert.equal((await account(" BCA")).balance, 10000000);
  const salaryRow = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " salary", { exact: true }) });
  assert((await salaryRow.innerText()).includes(prefix + " BCA"));
  const salary = (
    await sql`select id,received_at::text,funding_month::text from income where source=${prefix + " salary"}`
  )[0];
  assert.equal(salary.received_at, "2026-09-30");
  assert.equal(salary.funding_month, "2026-10-01");
  await go("/reports?month=2026-09");
  assert((await metric("Income")).includes(rupiah(10000000)));
  await go("/reports?month=2026-10");
  assert((await metric("Income")).includes(rupiah(0)));
  await go("/budget?month=2026-10");
  assert((await metric("Available to Allocate")).includes(rupiah(10000000)));
  await page.getByText(prefix + " salary", { exact: true }).waitFor();
  const ledgerBefore =
    await sql`select * from account_movements where account_id=${bank.id} order by id`;
  await go("/cash-flow");
  await salaryRow.getByRole("button", { name: "Edit", exact: true }).click();
  await fill({ "Use for Plan": "2026-11" });
  await save("Save Income");
  await page.reload();
  assert.deepEqual(
    await sql`select * from account_movements where account_id=${bank.id} order by id`,
    ledgerBefore,
  );
  assert.equal((await account(" BCA")).balance, 10000000);
  await go("/budget?month=2026-10");
  assert((await metric("Available to Allocate")).includes(rupiah(0)));
  await go("/budget?month=2026-11");
  assert((await metric("Available to Allocate")).includes(rupiah(10000000)));
  await go("/cash-flow");
  await salaryRow.getByRole("button", { name: "Edit", exact: true }).click();
  await fill({ "Use for Plan": "2026-10" });
  await save("Save Income");
  await button("Add Transaction").click();
  await dialog().getByRole("button", { name: "Expense", exact: true }).click();
  await fill({
    Description: prefix + " groceries",
    Amount: 250000,
    Date: "2026-10-10",
  });
  await dialog().getByLabel("Paid From", { exact: true }).selectOption(bank.id);
  await dialog().getByLabel("Plan Category", {exact:true}).selectOption("living");
  await save("Save Expense");
  await go("/bills");
  await button("+ Add Bill").click();
  await fill({
    "Bill name": prefix + " internet",
    Amount: 350000,
    Category: "utilities",
    "Due day": 15,
  });
  await save("Save Bill");
  const bill = page
    .locator("div.border-b")
    .filter({ has: page.getByText(prefix + " internet", { exact: true }) })
    .last();
  await bill.getByRole("button", { name: "Pay Bill", exact: true }).click();
  await dialog().getByLabel("Pay From", { exact: true }).selectOption(bank.id);
  await fill({ "Payment Date": "2026-10-10" });
  await save("Pay Bill");
  await button("Debt").click();
  await button("+ Add Debt").click();
  await fill({
    "Debt name": prefix + " debt",
    Lender: "QA",
    "Original amount": 2000000,
    "Remaining amount": 2000000,
    "Monthly payment": 1000000,
    "Due day": 15,
  });
  await save("Save Debt");
  await page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " debt", { exact: true }) })
    .getByRole("button", { name: "Record Payment", exact: true })
    .click();
  await fill({ "Payment amount": 1000000, "Payment Date": "2026-10-10" });
  await dialog().getByLabel("Pay From", { exact: true }).selectOption(bank.id);
  await save("Record Payment");
  assert.equal((await account(" BCA")).balance, 8400000);
  await go("/reports?month=2026-10");
  for (const [label, value] of [
    ["Spending", 600000],
    ["Cash Outflow", 1600000],
    ["Net Cash Flow", -1600000],
  ])
    assert((await metric(label)).includes(rupiah(value)));
  assert((await metric("Debt Progress")).includes(rupiah(1000000)));
  await go("/cash-flow");
  for (const suffix of [" internet", " debt"])
    assert.equal(
      await page
        .getByRole("article")
        .filter({ has: page.getByText(prefix + suffix, { exact: true }) })
        .count(),
      1,
    );
  await button("Add Transaction").click();
  await dialog().getByRole("button", { name: "Transfer", exact: true }).click();
  await fill({
    Amount: 500000,
    Date: "2026-10-10",
    Notes: prefix + " transfer",
  });
  await dialog()
    .getByLabel("From Account", { exact: true })
    .selectOption(bank.id);
  await dialog()
    .getByLabel("To Account", { exact: true })
    .selectOption(wallet.id);
  await save("Save Transfer");
  await page.reload();
  assert.equal(
    await page
      .getByRole("article")
      .filter({ has: page.getByText(prefix + " transfer", { exact: true }) })
      .count(),
    1,
  );
  assert.equal((await account(" BCA")).balance, 7900000);
  assert.equal((await account(" GoPay")).balance, 500000);
  await go("/reports?month=2026-10");
  for (const [label, value] of [
    ["Spending", 600000],
    ["Cash Outflow", 1600000],
    ["Net Cash Flow", -1600000],
  ])
    assert((await metric(label)).includes(rupiah(value)));
  await go("/cash-flow");
  await button("Add Transaction").click();
  await fill({
    Source: prefix + " override",
    Amount: 1000000,
    Date: "2026-09-28",
    "Use for Plan": "2026-09",
  });
  await dialog()
    .getByLabel("Received To", { exact: true })
    .selectOption(bank.id);
  await save("Save Income");
  await go("/budget?month=2026-09");
  assert((await metric("Available to Allocate")).includes(rupiah(1000000)));
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser v1.2: cutoff suggestion/override, September receipt vs October funding/report, funding-only edit without movements, paid bill/debt unified feed once, spending600k/outflow1.6m, transfer exclusion, refresh persistence.",
  );
} finally {
  await browser.close();
  await sql`delete from bills where name like ${prefix + "%"}`;
  await sql`delete from debts where name like ${prefix + "%"}`;
  await sql`delete from income where source like ${prefix + "%"}`;
  await sql`delete from expenses where description like ${prefix + "%"}`;
  await sql`delete from account_movements where account_id in (select id from finance_accounts where name like ${prefix + "%"})`;
  await sql`delete from finance_accounts where name like ${prefix + "%"}`;
  await sql.end();
}
