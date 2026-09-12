// Real Drizzle/PostgreSQL actions with only Next request cookies/cache mocked.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import postgres from "postgres";
const url = new URL(process.env.QA_DATABASE_URL);
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(url.pathname),
  "Only isolated local QA allowed",
);
process.env.DATABASE_URL = url.href;
process.env.AUTH_USERNAME = "qa-local";
process.env.AUTH_SESSION_SECRET = "local-test-secret-not-production";
const jar = new Map();
globalThis.qaCookies = {
  get: (name) => jar.get(name),
  set: (name, value, options) => jar.set(name, { value, ...options }),
};
globalThis.qaPaths = [];
registerHooks({
  resolve(specifier, context, next) {
    if (["next/headers", "next/cache", "next/navigation"].includes(specifier))
      return { url: "qa:" + specifier, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = resolve("src", specifier.slice(2));
      const file = [base + ".ts", resolve(base, "index.ts")].find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = fileURLToPath(new URL(specifier, context.parentURL));
      if (existsSync(file + ".ts"))
        return next(pathToFileURL(file + ".ts").href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "qa:next/headers")
      return {
        format: "module",
        source: "export async function cookies(){return globalThis.qaCookies}",
        shortCircuit: true,
      };
    if (url === "qa:next/cache")
      return {
        format: "module",
        source:
          "export function revalidatePath(path){globalThis.qaPaths.push(path)}",
        shortCircuit: true,
      };
    if (url === "qa:next/navigation")
      return {
        format: "module",
        source:
          "export function redirect(path){throw new Error('REDIRECT:'+path)}",
        shortCircuit: true,
      };
    return next(url, context);
  },
});
const cash = await import("../src/actions/cash-flow.ts");
const bills = await import("../src/actions/bills-debt.ts");
const goals = await import("../src/actions/goals.ts");
const plan = await import("../src/actions/plan.ts");
const notes = await import("../src/actions/planner.ts");
const accounts = await import("../src/actions/accounts.ts");
const session = await import("../src/lib/auth/session.ts");
const { currentMonth, jakartaDate } = await import("../src/lib/dates.ts");
const { getMonthlyReport } =
  await import("../src/lib/reports/monthly-report.ts");
const { getDashboardData } = await import("../src/lib/dashboard/data.ts");
const sql = postgres(url.href);
const form = (data) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, String(v));
  return f;
};
const prefix = "QA-actions-" + Date.now();
const month = currentMonth().start;
let owner;
try {
  for (const action of [
    ...Object.values(cash),
    ...Object.values(bills),
    ...Object.values(goals),
    ...Object.values(accounts),
    plan.updateMonthlyPlan,
    notes.createPlannerItem,
    notes.updatePlannerItem,
    notes.deletePlannerItem,
  ]) {
    await assert.rejects(() => action(form({})), /REDIRECT:\/login/);
  }
  await assert.rejects(() => getMonthlyReport(), /REDIRECT:\/login/);
  await assert.rejects(() => getDashboardData(), /REDIRECT:\/login/);
  await session.createSession("qa-local");
  assert.equal((await session.getSession()).username, "qa-local");
  const saved = jar.get("finance_session");
  jar.set("finance_session", {
    value: saved.value.slice(0, -10) + "tampered!!",
  });
  assert.equal(await session.getSession(), null);
  const { SignJWT } = await import("jose");
  const testSecret = new TextEncoder().encode(process.env.AUTH_SESSION_SECRET);
  jar.set("finance_session", {
    value: await new SignJWT({ authenticated: true, username: "qa-local" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(testSecret),
  });
  assert.equal(await session.getSession(), null, "Sessions require expiry");
  jar.set("finance_session", {
    value: await new SignJWT({ authenticated: true, username: "qa-local" })
      .setProtectedHeader({ alg: "HS384" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(testSecret),
  });
  assert.equal(
    await session.getSession(),
    null,
    "Unexpected signing algorithms are rejected",
  );
  jar.set("finance_session", saved);
  assert.equal(
    (
      await cash.createIncome(
        form({ label: prefix, amount: 100000, date: jakartaDate(), notes: "" }),
      )
    ).success,
    true,
  );
  owner = (
    await sql`select id from "user" where email='local@myfinance.private'`
  )[0].id;
  const income = (await sql`select * from income where source=${prefix}`)[0];
  assert.equal(
    (
      await cash.updateIncome(
        form({
          id: income.id,
          label: prefix,
          amount: 120000,
          date: jakartaDate(),
          notes: "edited",
        }),
      )
    ).success,
    true,
  );
  assert.equal(
    (await sql`select amount from income where id=${income.id}`)[0].amount,
    120000,
  );
  assert.equal(
    (
      await cash.createExpense(
        form({
          label: prefix,
          amount: 20000,
          date: jakartaDate(),
          notes: "living",
        }),
      )
    ).success,
    true,
  );
  const expense = (
    await sql`select * from expenses where description=${prefix}`
  )[0];
  assert.equal(
    (
      await cash.updateExpense(
        form({
          id: expense.id,
          label: prefix,
          amount: 21000,
          date: jakartaDate(),
          notes: "living",
        }),
      )
    ).success,
    true,
  );
  assert.equal(
    (
      await cash.createIncome(
        form({ label: prefix, amount: -1, date: jakartaDate() }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await cash.updateIncome(
        form({ label: prefix, amount: 5, date: jakartaDate() }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await bills.createBill(
        form({ name: prefix, category: "utilities", amount: 5000, dueDay: 31 }),
      )
    ).success,
    true,
  );
  const bill = (await sql`select * from bills where name=${prefix}`)[0];
  assert.equal((await bills.markBillPaid(form({ id: bill.id }))).success, true);
  assert.equal((await bills.markBillPaid(form({ id: bill.id }))).success, true);
  assert.equal(
    (
      await sql`select count(*)::int as n from bill_payments where bill_id=${bill.id}`
    )[0].n,
    1,
  );
  assert.equal(
    (
      await bills.createDebt(
        form({
          name: prefix,
          lender: "QA",
          originalAmount: 100,
          remainingAmount: 100,
          installmentAmount: 50,
          dueDay: 15,
        }),
      )
    ).success,
    true,
  );
  const debt = (await sql`select * from debts where name=${prefix}`)[0];
  const payments = await Promise.all([
    bills.recordDebtPayment(form({ id: debt.id, amount: 60 })),
    bills.recordDebtPayment(form({ id: debt.id, amount: 60 })),
  ]);
  assert(payments.every((p) => p.success));
  assert.deepEqual(
    (
      await sql`select remaining_amount,status from debts where id=${debt.id}`
    )[0],
    { remaining_amount: 0, status: "paid" },
  );
  assert.equal(
    Number(
      (
        await sql`select sum(amount) as n from debt_payments where debt_id=${debt.id}`
      )[0].n,
    ),
    100,
  );
  assert.equal(
    (await bills.recordDebtPayment(form({ id: debt.id, amount: 1 }))).success,
    false,
  );
  assert.equal(
    (
      await goals.createGoal(
        form({
          name: prefix,
          targetAmount: 100,
          currentAmount: 0,
          targetDate: "",
          priority: 2,
        }),
      )
    ).success,
    true,
  );
  const goal = (
    await sql`select * from financial_goals where name=${prefix}`
  )[0];
  const contributions = await Promise.all([
    goals.addGoalProgress(form({ id: goal.id, amount: 60 })),
    goals.addGoalProgress(form({ id: goal.id, amount: 60 })),
  ]);
  assert.equal(contributions.filter((p) => p.success).length, 1);
  assert.equal(
    (
      await goals.updateGoal(
        form({
          id: goal.id,
          name: prefix,
          targetAmount: 100,
          currentAmount: 0,
          targetDate: "",
          priority: 3,
        }),
      )
    ).success,
    true,
  );
  assert.equal(
    (
      await sql`select current_amount from financial_goals where id=${goal.id}`
    )[0].current_amount,
    60,
  );
  assert.equal(
    (await goals.addGoalProgress(form({ id: goal.id, amount: 40 }))).success,
    true,
  );
  assert.equal(
    (await goals.addGoalProgress(form({ id: goal.id, amount: 1 }))).success,
    false,
  );
  const allocations = {
    month,
    bills_debt: 5000,
    living: 10000,
    savings: 5000,
    investments: 0,
    lifestyle: 0,
    buffer: 5000,
  };
  assert.equal((await plan.updateMonthlyPlan(form(allocations))).success, true);
  assert.equal(
    (
      await plan.updateMonthlyPlan(
        form({ ...allocations, month: "2000-01-01" }),
      )
    ).success,
    false,
  );
  // A duplicate must roll back the entire edit, without removing legacy rows.
  const [duplicate] =
    await sql`insert into budgets(user_id,month,category,allocated_amount) values(${owner},${month},'savings',7) returning id`;
  const before =
    await sql`select id,allocated_amount from budgets where user_id=${owner} order by id`;
  assert.equal(
    (await plan.updateMonthlyPlan(form({ ...allocations, bills_debt: 999 })))
      .success,
    false,
  );
  assert.deepEqual(
    await sql`select id,allocated_amount from budgets where user_id=${owner} order by id`,
    before,
  );
  await sql`delete from budgets where id=${duplicate.id}`;
  assert.equal(
    (
      await bills.createDebt(
        form({
          name: prefix + " active",
          lender: "QA",
          originalAmount: 100,
          remainingAmount: 100,
          installmentAmount: 20,
          dueDay: 15,
        }),
      )
    ).success,
    true,
  );
  const activeDebt = (
    await sql`select * from debts where name=${prefix + " active"}`
  )[0];
  const [account] =
    await sql`insert into finance_accounts(user_id,name,type,balance) values(${owner},${prefix},'bank',1000000) returning id`;
  const report = await getMonthlyReport(),
    overview = await getDashboardData();
  assert.equal(overview.surplus, report.net);
  assert.equal(overview.debtTotal, report.debtRemaining);
  assert.equal(overview.savingRate, report.savingRate);
  assert.equal(
    overview.plan.allocated,
    Object.values(report.allocations).reduce((a, b) => a + b, 0),
  );
  assert.equal(overview.cashAvailable, 1000000);
  assert.equal(
    overview.safe,
    989980,
    "Payments on a paid-off debt must not offset another debt's installment",
  );
  assert.equal(
    (await bills.deleteDebt(form({ id: activeDebt.id }))).success,
    true,
  );
  await sql`delete from finance_accounts where id=${account.id}`;
  for (const path of [
    "/cash-flow",
    "/bills",
    "/goals",
    "/budget",
    "/reports",
    "/dashboard",
  ])
    assert(globalThis.qaPaths.includes(path));
  for (const [action, id] of [
    [cash.deleteIncome, income.id],
    [cash.deleteExpense, expense.id],
    [bills.deleteBill, bill.id],
    [bills.deleteDebt, debt.id],
    [goals.deleteGoal, goal.id],
  ])
    assert.equal((await action(form({ id }))).success, true);
  const accountIds = [];
  const beforeCash = (await getDashboardData()).cashAvailable;
  let addedLiquid = 0;
  for (const type of ["bank", "cash", "e_wallet", "investment", "other"]) {
    assert.equal(
      (
        await accounts.createAccount(
          form({
            name: prefix + " account " + type,
            type,
            balance: 100,
            institution: "QA",
          }),
        )
      ).success,
      true,
    );
    const [row] =
      await sql`select * from finance_accounts where name=${prefix + " account " + type}`;
    accountIds.push(row.id);
    assert.equal(row.balance, 100);
    if (["bank", "cash", "e_wallet"].includes(type)) addedLiquid += 100;
    assert.equal(
      (await getDashboardData()).cashAvailable,
      beforeCash + addedLiquid,
    );
  }
  const bankId = accountIds[0];
  assert.equal(
    (
      await accounts.updateAccountBalance(
        form({ id: bankId, balance: 7500000, name: "ignored" }),
      )
    ).success,
    true,
  );
  assert.equal(
    (
      await accounts.updateAccount(
        form({
          id: bankId,
          name: prefix + " account bank",
          type: "bank",
          institution: "Updated",
          isActive: "true",
          balance: 0,
        }),
      )
    ).success,
    true,
  );
  assert.equal(
    (await sql`select balance from finance_accounts where id=${bankId}`)[0]
      .balance,
    7500000,
    "Metadata edits cannot overwrite balance",
  );
  for (const value of ["", "1.5", "2147483648", "-2147483649", "not-money"])
    assert.equal(
      (
        await accounts.updateAccountBalance(
          form({ id: bankId, balance: value }),
        )
      ).success,
      false,
    );
  assert.equal(
    (
      await accounts.createAccount(
        form({ name: " ", type: "bank", balance: 0 }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await accounts.createAccount(
        form({ name: "QA", type: "unsupported", balance: 0 }),
      )
    ).success,
    false,
  );
  assert.equal(
    (await accounts.updateAccountBalance(form({ id: bankId, balance: -100 })))
      .success,
    true,
  );
  assert.equal(
    (await getDashboardData()).cashAvailable,
    beforeCash + 100,
    "Signed overdraft balances are not clamped away",
  );
  assert.equal(
    (await accounts.deactivateAccount(form({ id: bankId }))).success,
    true,
  );
  assert.equal(
    (await sql`select is_active from finance_accounts where id=${bankId}`)[0]
      .is_active,
    false,
  );
  assert.equal((await getDashboardData()).cashAvailable, beforeCash + 200);
  assert.equal(
    (
      await accounts.updateAccount(
        form({
          id: bankId,
          name: prefix + " account bank",
          type: "bank",
          institution: "",
          isActive: "true",
        }),
      )
    ).success,
    true,
  );
  assert.equal((await getDashboardData()).cashAvailable, beforeCash + 100);
  const [foreignUser] =
    await sql`insert into "user"(email) values(${prefix + "@qa.local"}) returning id`;
  const [foreign] =
    await sql`insert into finance_accounts(user_id,name,type,balance) values(${foreignUser.id},'Foreign QA','bank',1) returning id`;
  for (const action of [
    accounts.updateAccount,
    accounts.updateAccountBalance,
    accounts.deactivateAccount,
  ])
    assert.equal(
      (
        await action(
          form({
            id: foreign.id,
            name: "Unauthorized",
            type: "bank",
            institution: "",
            isActive: "false",
            balance: 0,
          }),
        )
      ).success,
      false,
    );
  assert.equal(
    (await sql`select balance from finance_accounts where id=${foreign.id}`)[0]
      .balance,
    1,
  );
  await sql`delete from finance_accounts where id=${foreign.id}`;
  await sql`delete from "user" where id=${foreignUser.id}`;
  assert(globalThis.qaPaths.includes("/accounts"));
  for (const id of accountIds)
    await sql`delete from finance_accounts where id=${id}`;
  console.log(
    "PASS Accounts actions: all types, balances, metadata preservation, validation, deactivate/reactivate, ownership, shared Overview totals.",
  );
  const { db } = await import("../src/db/index.ts");
  await db.$client.end();
  assert.equal(
    (
      await cash.createIncome(
        form({ label: prefix, amount: 1, date: jakartaDate() }),
      )
    ).success,
    false,
    "Unavailable database never returns fake success",
  );
  await assert.rejects(
    () => getMonthlyReport(),
    "Unavailable database never becomes zero financial data",
  );
  await session.deleteSession();
  assert.equal(jar.get("finance_session").maxAge, 0);
  assert.equal(await session.getSession(), null);
  console.log(
    "PASS: auth on every mutation, tampered cookie/logout, cash CRUD, paid bill idempotency, concurrent debt/goal transactions, metadata preservation, stale/duplicate Plan safety, source/Overview agreement.",
  );
} finally {
  // The isolated QA database remains available for browser verification. No Neon connection is used.
  await sql.end();
  const { db } = await import("../src/db/index.ts");
  await db.$client.end();
}
