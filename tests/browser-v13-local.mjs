import assert from "node:assert/strict";
import { createRequire } from "node:module";
import postgres from "postgres";
import { rupiah } from "../src/lib/currency.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const url = new URL(process.env.QA_DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname) && /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname));
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3005";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const sql = postgres(url.href), prefix = "QA-v13browser-" + Date.now();
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === 'error') errors.push(m.text()); });
const go = async path => { await page.goto(base + path); await page.getByRole('heading', { level: 1 }).waitFor(); };
const button = name => page.getByRole('button', { name, exact: true });
const dialog = () => page.getByRole('dialog');
const fill = async fields => { for (const [name, value] of Object.entries(fields)) await dialog().getByLabel(name, { exact: true }).fill(String(value)); };
const save = async name => { await dialog().getByRole('button', { name, exact: true }).click(); await dialog().waitFor({ state: 'hidden' }); };
const row = label => page.getByRole('article').filter({ has: page.getByText(prefix + label, { exact: true }) });
const planRow = label => page.locator('div.grid.gap-3.py-5').filter({ has: page.getByText(label, { exact: true }) });
let accountIds = [], billId, debtIds = [], owner;
try {
  await go('/login'); await page.getByLabel('Username').fill('qa-local'); await page.getByLabel('Password', { exact: true }).fill('qa-local-password'); await button('Sign In').click(); await page.waitForURL(base + '/dashboard');
  assert((await page.locator('.overview-safe').innerText()).includes('Not available'));
  await go('/accounts');
  for (const [suffix, type] of [[' bank', 'bank'], [' wallet', 'e_wallet'], [' investments', 'investment'], [' savings', 'bank']]) {
    await button('+ Add Account').first().click(); await fill({ 'Account Name': prefix + suffix, 'Current Balance': 0 }); await dialog().locator('select[name="type"]').selectOption(type); await save('Add Account');
    accountIds.push((await sql`select id from finance_accounts where name=${prefix + suffix}`)[0].id);
  }
  const [bank, wallet, investment, savings] = accountIds;
  owner = (await sql`select user_id from finance_accounts where id=${bank}`)[0].user_id;
  await go('/cash-flow');
  for (const close of ['Cancel', 'Close dialog', 'Escape']) {
    const before = await sql`select count(*)::int n from account_movements`;
    await button('Add Transaction').click(); await dialog().getByRole('button', { name: 'Expense', exact: true }).click(); await fill({ Description: 'Unsaved' });
    if (close === 'Escape') await page.keyboard.press('Escape'); else await dialog().getByRole('button', { name: close, exact: true }).click();
    await dialog().waitFor({ state: 'hidden' }); assert.deepEqual(await sql`select count(*)::int n from account_movements`, before);
    await button('Add Transaction').click(); await dialog().getByRole('button', { name: 'Expense', exact: true }).click(); assert.equal(await dialog().getByLabel('Description', { exact: true }).inputValue(), ''); await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'hidden' });
  }
  await button('Add Transaction').click(); await fill({ Source: prefix + ' salary', Amount: 30000000, Date: '2026-09-30' }); await dialog().getByLabel('Received To', { exact: true }).selectOption(bank); await save('Save Income');
  await button('Add Transaction').click(); await dialog().getByRole('button', { name: 'Expense', exact: true }).click(); await fill({ Description: prefix + ' food', Amount: 100000, Date: '2026-10-02' }); await dialog().getByLabel('Paid From', { exact: true }).selectOption(bank); await dialog().getByLabel('Plan Category', { exact: true }).selectOption('living'); await save('Save Expense');
  await page.reload(); assert((await row(' food').innerText()).includes('Living Expenses'));
  const balances = await sql`select id,balance from finance_accounts order by id`, ledger = await sql`select * from account_movements order by id`;
  await row(' food').getByRole('button', { name: 'Edit', exact: true }).click(); await dialog().getByLabel('Plan Category', { exact: true }).selectOption('lifestyle'); await save('Save Expense'); await page.reload();
  assert.deepEqual(await sql`select id,balance from finance_accounts order by id`, balances); assert.deepEqual(await sql`select * from account_movements order by id`, ledger); assert((await row(' food').innerText()).includes('Lifestyle'));
  await row(' food').getByRole('button', { name: 'Edit', exact: true }).click(); await fill({ Amount: 4000000 }); await dialog().getByLabel('Plan Category', { exact: true }).selectOption('living'); await save('Save Expense');
  await button('Add Transaction').click(); await dialog().getByRole('button', { name: 'Expense', exact: true }).click(); await fill({ Description: prefix + ' legacy', Amount: 1255951, Date: '2026-10-02' }); await dialog().getByLabel('Paid From', { exact: true }).selectOption(bank); await dialog().getByLabel('Plan Category', { exact: true }).selectOption('buffer'); await save('Save Expense');
  await sql`update expenses set plan_category=null where description=${prefix + ' legacy'}`;
  await go('/bills'); await button('+ Add Bill').click(); await fill({ 'Bill name': prefix + ' bill', Amount: 438000, Category: 'Other', 'Due day': 2 }); await save('Save Bill');
  billId = (await sql`select id from bills where name=${prefix + ' bill'}`)[0].id;
  const bill = page.locator('div.border-b').filter({ has: page.getByText(prefix + ' bill', { exact: true }) }).last(); await bill.getByRole('button', { name: 'Pay Bill', exact: true }).click(); await dialog().getByLabel('Pay From', { exact: true }).selectOption(bank); await fill({ 'Payment Date': '2026-10-02' }); await save('Pay Bill');
  await button('Debt').click();
  for (const [suffix, amount] of [[' paid', 6987699], [' pending', 4600000]]) {
    await button('+ Add Debt').click(); await fill({ 'Debt name': prefix + suffix, Lender: 'QA', 'Original amount': amount, 'Remaining amount': amount, 'Monthly payment': amount, 'Due day': 5 }); await save('Save Debt'); debtIds.push((await sql`select id from debts where name=${prefix + suffix}`)[0].id);
  }
  const debt = page.getByRole('article').filter({ has: page.getByText(prefix + ' paid', { exact: true }) }); await debt.getByRole('button', { name: 'Record Payment', exact: true }).click(); await fill({ 'Payment amount': 6987699, 'Payment Date': '2026-10-02' }); await dialog().getByLabel('Pay From', { exact: true }).selectOption(bank); await save('Record Payment');
  await page.reload(); assert.equal(await debt.getByRole('button', { name: 'Record Payment', exact: true }).count(), 0);
  await go('/cash-flow');
  for (const [destination, amount, impact, suffix] of [[investment, 5000000, 'none', ' invest'], [wallet, 500000, 'none', ' wallet transfer'], [savings, 200000, 'savings', ' savings transfer']]) {
    await button('Add Transaction').click(); await dialog().getByRole('button', { name: 'Transfer', exact: true }).click(); await fill({ Amount: amount, Date: '2026-10-02', Notes: prefix + suffix }); await dialog().getByLabel('From Account', { exact: true }).selectOption(bank); await dialog().getByLabel('To Account', { exact: true }).selectOption(destination); await dialog().getByLabel('Plan Impact', { exact: true }).selectOption(impact); await save('Save Transfer');
  }
  await row(' savings transfer').getByRole('button', { name: 'Revert', exact: true }).click(); await save('Revert Transfer');
  await go('/budget?month=2026-10'); await button('Edit Plan').click(); await fill({ 'Bills & Debt': 12000000, 'Living Expenses': 10000000, Savings: 0, Investments: 5000000, Lifestyle: 3000000, Buffer: 0 }); await save('Save Plan'); await page.reload();
  assert((await planRow('Living Expenses').innerText()).includes(rupiah(4000000))); assert((await planRow('Living Expenses').innerText()).includes(rupiah(6000000))); assert((await planRow('Investments').innerText()).includes('100% used')); assert((await planRow('Bills & Debt').innerText()).includes(rupiah(7425699)));
  await page.getByRole('link', { name: 'Review in Activity', exact: true }).click(); await page.getByLabel('Filter Plan Category', { exact: true }).waitFor(); assert.equal(await page.getByRole('article').count(), 1); assert((await row(' legacy').innerText()).includes('Uncategorized'));
  await go('/dashboard'); assert((await page.locator('.overview-safe').innerText()).includes(rupiah(1718350)));
  await go('/reports?month=2026-10'); for (const amount of [5693951, 12681650]) assert((await page.locator('main').innerText()).includes(rupiah(amount)));
  const beforePlan = await sql`select id,balance from finance_accounts order by id`, beforePlanLedger = await sql`select * from account_movements order by id`;
  await go('/budget?month=2026-10'); await button('Edit Plan').click(); await fill({ 'Living Expenses': 1000000 }); await save('Save Plan'); assert((await planRow('Living Expenses').innerText()).includes('Over by ' + rupiah(3000000))); assert.deepEqual(await sql`select id,balance from finance_accounts order by id`, beforePlan); assert.deepEqual(await sql`select * from account_movements order by id`, beforePlanLedger);
  for (const width of [1440, 768, 375]) { await page.setViewportSize({ width, height: 900 }); for (const path of ['/budget', '/cash-flow', '/dashboard']) { await go(path); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ' overflow at ' + width); } }
  assert.deepEqual(errors, []);
  console.log('PASS browser v1.3: canonical dropdown, category-only edits/no ledger writes, dialogs/reset, Plan actual usage/overage, legacy review/filter, payments and investment/savings transfers, exact Safe-to-Spend, report preservation, refresh and responsive layout.');
} finally {
  await browser.close();
  if (billId) await sql`delete from bills where id=${billId}`;
  if (debtIds.length) await sql`delete from debts where id=any(${debtIds})`;
  if (owner) await sql`delete from budgets where user_id=${owner} and month='2026-10-01'`;
  if (accountIds.length) {
    await sql`delete from transfer_plan_attributions where id in (select reference_id from account_movements where account_id=any(${accountIds}))`;
    await sql`delete from income where account_id=any(${accountIds})`; await sql`delete from expenses where account_id=any(${accountIds})`; await sql`delete from account_movements where account_id=any(${accountIds})`; await sql`delete from finance_accounts where id=any(${accountIds})`;
  }
  await sql.end();
}
