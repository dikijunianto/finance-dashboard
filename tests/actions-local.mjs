// Real Drizzle/PostgreSQL actions with only Next request cookies/cache mocked.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
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
  for (const [k, v] of Object.entries({
    accountId: paymentAccountId,
    requestId: randomUUID(),
    date: jakartaDate(),
    category: data.notes || "Other",
    ...data,
  }))
    f.set(k, String(v));
  return f;
};
const prefix = "QA-actions-" + Date.now();
const month = currentMonth().start;
let owner;
let paymentAccountId = "";
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
  const { requireOwner } = await import("../src/lib/action-result.ts");
  owner = await requireOwner();
  const opening = form({
    name: prefix + " payment account",
    type: "other",
    balance: 0,
  });
  assert.equal((await accounts.createAccount(opening)).success, true);
  paymentAccountId = (
    await sql`select id from finance_accounts where name=${prefix + " payment account"}`
  )[0].id;
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
  assert.equal(
    (
      await cash.createIncome(
        form({ accountId: foreign.id, label: "Unauthorized", amount: 1 }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await cash.createExpense(
        form({ accountId: foreign.id, label: "Unauthorized", amount: 1 }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await cash.createTransfer(
        form({ fromAccountId: bankId, toAccountId: foreign.id, amount: 1 }),
      )
    ).success,
    false,
  );
  await sql`delete from finance_accounts where id=${foreign.id}`;
  await sql`delete from "user" where id=${foreignUser.id}`;
  assert(globalThis.qaPaths.includes("/accounts"));
  for (const id of accountIds) {
    await sql`delete from account_movements where account_id=${id}`;
    await sql`delete from finance_accounts where id=${id}`;
  }
  console.log(
    "PASS Accounts actions: all types, balances, metadata preservation, validation, deactivate/reactivate, ownership, shared Overview totals.",
  );
  // v1.1: exact account effects, reversals, retries, concurrent writes and rollbacks.
  const v1Ids = [];
  const createMoneyAccount = async (suffix, balance, type = "bank") => {
    const f = form({ name: prefix + suffix, type, balance });
    assert.equal((await accounts.createAccount(f)).success, true);
    assert.equal(
      (await accounts.createAccount(f)).success,
      true,
      "Opening retry is a no-op",
    );
    const [a] =
      await sql`select * from finance_accounts where name=${prefix + suffix}`;
    v1Ids.push(a.id);
    assert.equal(
      (
        await sql`select count(*)::int n from account_movements where account_id=${a.id}`
      )[0].n,
      1,
    );
    return a.id;
  };
  const bank = await createMoneyAccount(" v1 bank", 5000000);
  const wallet = await createMoneyAccount(" v1 wallet", 0, "e_wallet");
  const investment = await createMoneyAccount(
    " v1 investment",
    0,
    "investment",
  );
  const extreme = await createMoneyAccount(
    " v1 extremes",
    -2147483648,
    "other",
  );
  assert.equal(
    (
      await accounts.updateAccountBalance(
        form({ id: extreme, balance: 2147483647 }),
      )
    ).success,
    true,
  );
  assert.equal(
    Number(
      (
        await sql`select amount from account_movements where account_id=${extreme} and type='adjustment'`
      )[0].amount,
    ),
    4294967295,
  );
  const amountAt = async (id) =>
    (await sql`select balance from finance_accounts where id=${id}`)[0].balance;
  const ledgerAgrees = async () => {
    for (const id of v1Ids)
      assert.equal(
        Number(
          (
            await sql`select coalesce(sum(amount),0) n from account_movements where account_id=${id}`
          )[0].n,
        ),
        await amountAt(id),
        "Ledger explains materialized balance",
      );
  };
  const salaryForm = form({
    accountId: bank,
    label: prefix + " salary",
    amount: 10000000,
  });
  assert.equal((await cash.createIncome(salaryForm)).success, true);
  assert.equal((await cash.createIncome(salaryForm)).success, true);
  assert.equal(await amountAt(bank), 15000000);
  const salary = (
    await sql`select id from income where source=${prefix + " salary"}`
  )[0].id;
  const expenseForm = form({
    accountId: bank,
    label: prefix + " grocery",
    category: "living",
    amount: 250000,
  });
  assert.equal((await cash.createExpense(expenseForm)).success, true);
  assert.equal(await amountAt(bank), 14750000);
  const grocery = (
    await sql`select id from expenses where description=${prefix + " grocery"}`
  )[0].id;
  assert.equal(
    (
      await cash.updateExpense(
        form({
          id: grocery,
          accountId: bank,
          label: prefix + " grocery",
          category: "living",
          amount: 300000,
        }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), 14700000);
  assert.equal(
    (
      await cash.updateExpense(
        form({
          id: grocery,
          accountId: wallet,
          label: prefix + " grocery",
          category: "living",
          amount: 300000,
        }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), 15000000);
  assert.equal(await amountAt(wallet), -300000);
  assert.equal((await cash.deleteExpense(form({ id: grocery }))).success, true);
  assert.equal(await amountAt(wallet), 0);
  assert.equal(await amountAt(bank), 15000000);
  const beforeTransferReport = await getMonthlyReport();
  const transferForm = form({
    fromAccountId: bank,
    toAccountId: wallet,
    amount: 500000,
  });
  assert.equal((await cash.createTransfer(transferForm)).success, true);
  assert.equal((await cash.createTransfer(transferForm)).success, true);
  assert.equal(await amountAt(bank), 14500000);
  assert.equal(await amountAt(wallet), 500000);
  assert.equal((await getDashboardData()).cashAvailable, 15000000);
  const afterTransferReport = await getMonthlyReport();
  for (const key of ["income", "expenses", "net", "savingRate"])
    assert.equal(afterTransferReport[key], beforeTransferReport[key]);
  assert.equal(
    (
      await bills.createBill(
        form({
          name: prefix + " internet",
          amount: 350000,
          category: "utilities",
          dueDay: 15,
        }),
      )
    ).success,
    true,
  );
  const internet = (
    await sql`select id from bills where name=${prefix + " internet"}`
  )[0].id;
  await Promise.all(
    [1, 2].map(() =>
      bills.markBillPaid(form({ id: internet, accountId: bank })),
    ),
  );
  assert.equal(await amountAt(bank), 14150000);
  assert.equal(
    (
      await sql`select count(*)::int n from bill_payments where bill_id=${internet}`
    )[0].n,
    1,
  );
  assert.equal(
    (
      await bills.createDebt(
        form({
          name: prefix + " loan",
          lender: "QA",
          originalAmount: 5000000,
          remainingAmount: 5000000,
          installmentAmount: 1000000,
          dueDay: 15,
        }),
      )
    ).success,
    true,
  );
  const loan = (
    await sql`select id from debts where name=${prefix + " loan"}`
  )[0].id;
  const payment = form({ id: loan, amount: 1000000, accountId: bank });
  assert.equal((await bills.recordDebtPayment(payment)).success, true);
  assert.equal((await bills.recordDebtPayment(payment)).success, true);
  assert.equal(await amountAt(bank), 13150000);
  assert.equal(
    (await sql`select remaining_amount from debts where id=${loan}`)[0]
      .remaining_amount,
    4000000,
  );
  assert.equal(
    (
      await bills.recordDebtPayment(
        form({ id: loan, amount: 4000000, accountId: bank }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), 9150000);
  assert.deepEqual(
    (await sql`select remaining_amount,status from debts where id=${loan}`)[0],
    { remaining_amount: 0, status: "paid" },
  );
  assert.equal(
    (
      await bills.recordDebtPayment(
        form({ id: loan, amount: 1, accountId: bank }),
      )
    ).success,
    false,
  );
  assert.equal(await amountAt(bank), 9150000);
  const beforeReconciliationReport = await getMonthlyReport();
  const reconcile = form({ id: bank, balance: 10000000 });
  assert.equal((await accounts.updateAccountBalance(reconcile)).success, true);
  assert.equal((await accounts.updateAccountBalance(reconcile)).success, true);
  assert.equal(
    (
      await accounts.updateAccountBalance(
        form({ id: bank, balance: 9975000, notes: "Bank statement" }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), 9975000);
  assert.equal(
    Number(
      (
        await sql`select amount from account_movements where account_id=${bank} and description='Bank statement'`
      )[0].amount,
    ),
    -25000,
  );
  const beforePlanning = await amountAt(bank);
  assert.equal((await plan.updateMonthlyPlan(form(allocations))).success, true);
  assert.equal(
    (
      await goals.createGoal(
        form({
          name: prefix + " reserve",
          targetAmount: 100,
          currentAmount: 0,
          targetDate: "",
          priority: 1,
        }),
      )
    ).success,
    true,
  );
  const reserve = (
    await sql`select id from financial_goals where name=${prefix + " reserve"}`
  )[0].id;
  assert.equal(
    (await goals.addGoalProgress(form({ id: reserve, amount: 50 }))).success,
    true,
  );
  assert.equal(await amountAt(bank), beforePlanning);
  const afterAdjustmentReport = await getMonthlyReport();
  for (const key of ["income", "expenses", "net"])
    assert.equal(afterAdjustmentReport[key], beforeReconciliationReport[key]);
  // Amount edits and account changes reverse the previous linked effect exactly.
  assert.equal(
    (
      await cash.updateIncome(
        form({
          id: salary,
          label: prefix + " salary",
          accountId: bank,
          amount: 12000000,
        }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), 11975000);
  assert.equal(
    (
      await cash.updateIncome(
        form({
          id: salary,
          label: prefix + " salary",
          accountId: wallet,
          amount: 12000000,
        }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(bank), -25000);
  assert.equal(await amountAt(wallet), 12500000);
  assert.equal((await cash.deleteIncome(form({ id: salary }))).success, true);
  assert.equal(await amountAt(wallet), 500000);
  const legacyId = randomUUID();
  await sql`insert into expenses(id,user_id,account_id,description,category,amount,spent_at) values(${legacyId},${owner},${bank},${prefix + " legacy"},'Other',100,${jakartaDate()})`;
  const legacyBefore = await amountAt(bank);
  assert.equal(
    (
      await cash.updateExpense(
        form({
          id: legacyId,
          accountId: wallet,
          label: prefix + " legacy",
          category: "Other",
          amount: 150,
        }),
      )
    ).success,
    true,
  );
  assert.equal(
    await amountAt(bank),
    legacyBefore,
    "Never replay an old account link without ledger evidence",
  );
  assert.equal(await amountAt(wallet), 499850);
  assert.equal(
    (await cash.deleteExpense(form({ id: legacyId }))).success,
    true,
  );
  const concurrent = await Promise.all(
    [1, 2].map((n) =>
      cash.createExpense(
        form({
          label: prefix + " concurrent " + n,
          category: "Other",
          amount: 100,
          accountId: wallet,
        }),
      ),
    ),
  );
  assert(concurrent.every((r) => r.success));
  assert.equal(await amountAt(wallet), 499800);
  const sameRequest = form({
    accountId: wallet,
    label: prefix + " retry",
    amount: 10,
  });
  assert(
    (
      await Promise.all([
        cash.createIncome(sameRequest),
        cash.createIncome(sameRequest),
      ])
    ).every((r) => r.success),
  );
  assert.equal(await amountAt(wallet), 499810);
  const retryIncome = (
    await sql`select id from income where source=${prefix + " retry"}`
  )[0].id;
  await cash.deleteIncome(form({ id: retryIncome }));
  assert.equal(await amountAt(wallet), 499800);
  const opposite = await Promise.all([
    cash.createTransfer(
      form({ fromAccountId: wallet, toAccountId: bank, amount: 10 }),
    ),
    cash.createTransfer(
      form({ fromAccountId: bank, toAccountId: wallet, amount: 10 }),
    ),
  ]);
  assert(
    opposite.every((r) => r.success),
    "Opposite transfers cannot deadlock",
  );
  assert.equal(await amountAt(wallet), 499800);
  assert.equal(
    (
      await cash.createTransfer(
        form({ fromAccountId: wallet, toAccountId: investment, amount: 1000 }),
      )
    ).success,
    true,
  );
  assert.equal(
    (await getDashboardData()).cashAvailable,
    (await amountAt(bank)) + (await amountAt(wallet)),
  );
  const transfer = (
    await sql`select reference_id from account_movements where request_id=${transferForm.get("requestId")}`
  )[0].reference_id;
  assert.equal(
    (await cash.revertTransfer(form({ id: transfer }))).success,
    true,
  );
  assert.equal(
    (await cash.revertTransfer(form({ id: transfer }))).success,
    true,
  );
  assert.equal(
    (
      await cash.createTransfer(
        form({ fromAccountId: bank, toAccountId: bank, amount: 1 }),
      )
    ).success,
    false,
  );
  await accounts.deactivateAccount(form({ id: investment }));
  assert.equal(
    (
      await cash.createIncome(
        form({ accountId: investment, label: "Rejected", amount: 1 }),
      )
    ).success,
    false,
  );
  assert.equal(
    (
      await cash.createExpense(
        form({
          accountId: randomUUID(),
          label: "Rejected",
          category: "Other",
          amount: 1,
        }),
      )
    ).success,
    false,
  );
  // Fail on ledger insertion AFTER the balance/domain mutations, proving full rollback.
  await sql.unsafe(
    "CREATE OR REPLACE FUNCTION qa_reject_movement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = 'QA_FORCE_ROLLBACK' OR EXISTS(SELECT 1 FROM finance_accounts WHERE id=NEW.account_id AND name='QA_FORCE_ROLLBACK') THEN RAISE EXCEPTION 'forced QA rollback'; END IF; RETURN NEW; END $$",
  );
  await sql.unsafe(
    "CREATE TRIGGER qa_reject_movement BEFORE INSERT ON account_movements FOR EACH ROW EXECUTE FUNCTION qa_reject_movement()",
  );
  try {
    const before = await amountAt(bank);
    assert.equal(
      (
        await accounts.createAccount(
          form({ name: "QA_FORCE_ROLLBACK", type: "bank", balance: 100 }),
        )
      ).success,
      false,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from finance_accounts where name='QA_FORCE_ROLLBACK'`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await cash.createExpense(
          form({ accountId: bank, label: "QA_FORCE_ROLLBACK", amount: 100 }),
        )
      ).success,
      false,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from expenses where description='QA_FORCE_ROLLBACK'`
      )[0].n,
      0,
    );
    assert.equal(await amountAt(bank), before);
    await bills.createBill(
      form({
        name: "QA_FORCE_ROLLBACK",
        amount: 100,
        dueDay: 1,
        category: "QA",
      }),
    );
    const failBill = (
      await sql`select id from bills where name='QA_FORCE_ROLLBACK'`
    )[0].id;
    assert.equal(
      (await bills.markBillPaid(form({ id: failBill, accountId: bank })))
        .success,
      false,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from bill_payments where bill_id=${failBill}`
      )[0].n,
      0,
    );
    assert.equal(await amountAt(bank), before);
    await bills.deleteBill(form({ id: failBill }));
    await bills.createDebt(
      form({
        name: "QA_FORCE_ROLLBACK",
        lender: "QA",
        originalAmount: 100,
        remainingAmount: 100,
        installmentAmount: 10,
        dueDay: 1,
      }),
    );
    const failDebt = (
      await sql`select id from debts where name='QA_FORCE_ROLLBACK'`
    )[0].id;
    assert.equal(
      (
        await bills.recordDebtPayment(
          form({ id: failDebt, accountId: bank, amount: 50 }),
        )
      ).success,
      false,
    );
    assert.equal(
      (await sql`select remaining_amount from debts where id=${failDebt}`)[0]
        .remaining_amount,
      100,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from debt_payments where debt_id=${failDebt}`
      )[0].n,
      0,
    );
    assert.equal(await amountAt(bank), before);
    await bills.deleteDebt(form({ id: failDebt }));
    assert.equal(
      (
        await cash.createIncome(
          form({ accountId: bank, label: "QA_FORCE_ROLLBACK", amount: 100 }),
        )
      ).success,
      false,
    );
    assert.equal(await amountAt(bank), before);
    assert.equal(
      (
        await sql`select count(*)::int n from income where source='QA_FORCE_ROLLBACK'`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await cash.createTransfer(
          form({
            fromAccountId: bank,
            toAccountId: wallet,
            amount: 100,
            notes: "QA_FORCE_ROLLBACK",
          }),
        )
      ).success,
      false,
    );
    assert.equal(await amountAt(bank), before);
    assert.equal(
      (
        await accounts.updateAccountBalance(
          form({ id: bank, balance: 0, notes: "QA_FORCE_ROLLBACK" }),
        )
      ).success,
      false,
    );
    assert.equal(await amountAt(bank), before);
  } finally {
    await sql.unsafe("DROP TRIGGER qa_reject_movement ON account_movements");
    await sql.unsafe("DROP FUNCTION qa_reject_movement()");
  }
  await ledgerAgrees();
  const preRefund = await amountAt(bank);
  assert.equal((await bills.deleteBill(form({ id: internet }))).success, true);
  assert.equal(await amountAt(bank), preRefund + 350000);
  assert.equal((await bills.deleteDebt(form({ id: loan }))).success, true);
  assert.equal(await amountAt(bank), preRefund + 5350000);
  await ledgerAgrees();
  await goals.deleteGoal(form({ id: reserve }));
  for (const id of v1Ids) {
    await sql`delete from income where account_id=${id}`;
    await sql`delete from expenses where account_id=${id}`;
    await sql`delete from account_movements where account_id=${id}`;
    await sql`delete from finance_accounts where id=${id}`;
  }
  await sql`delete from account_movements where account_id=${paymentAccountId}`;
  await sql`delete from finance_accounts where id=${paymentAccountId}`;
  console.log(
    "PASS v1.1: opening, income/expense edits/deletes, legacy conversion, transfers/reverts, payment retries/refunds, reconciliation, concurrency, rollback, ledger sums and read-only planning/report semantics.",
  );
  // v1.2: actual cash flow and planning funding are intentionally independent.
  const { getPlanFunding } = await import("../src/lib/plan-funding.ts");
  const september = new Date("2026-09-15T12:00:00+07:00"),
    october = new Date("2026-10-15T12:00:00+07:00");
  const septBefore = await getMonthlyReport(september),
    octBefore = await getMonthlyReport(october);
  const fundingBefore = await getPlanFunding("2026-10-01");
  await accounts.createAccount(
    form({ name: prefix + " v12 bank", type: "bank", balance: 0 }),
  );
  const v12Bank = (
    await sql`select id from finance_accounts where name=${prefix + " v12 bank"}`
  )[0].id;
  const v12SalaryForm = form({
    accountId: v12Bank,
    label: prefix + " v12 salary",
    amount: 10000000,
    date: "2026-09-30",
    fundingMonth: "2026-10-01",
  });
  assert.equal((await cash.createIncome(v12SalaryForm)).success, true);
  const v12Salary = (
    await sql`select id from income where source=${prefix + " v12 salary"}`
  )[0].id;
  assert.equal(
    (await getMonthlyReport(september)).income,
    septBefore.income + 10000000,
  );
  assert.equal((await getMonthlyReport(october)).income, octBefore.income);
  assert.equal(
    (await getPlanFunding("2026-10-01")).amount,
    fundingBefore.amount + 10000000,
  );
  const ledgerBeforeFunding =
    await sql`select * from account_movements where account_id=${v12Bank} order by id`;
  const fundingEdit = form({
    id: v12Salary,
    accountId: v12Bank,
    label: prefix + " v12 salary",
    amount: 10000000,
    date: "2026-09-30",
    fundingMonth: "2026-11-01",
  });
  assert.equal((await cash.updateIncome(fundingEdit)).success, true);
  assert.equal((await cash.updateIncome(fundingEdit)).success, true);
  assert.deepEqual(
    await sql`select * from account_movements where account_id=${v12Bank} order by id`,
    ledgerBeforeFunding,
  );
  assert.equal(await amountAt(v12Bank), 10000000);
  assert.equal(
    (await getPlanFunding("2026-10-01")).amount,
    fundingBefore.amount,
  );
  assert.equal(
    (await getPlanFunding("2026-11-01")).sources.find((x) => x.id === v12Salary)
      .receivedAt,
    "2026-09-30",
  );
  assert.equal(
    (
      await cash.updateIncome(
        form({
          id: v12Salary,
          accountId: v12Bank,
          label: "bad",
          amount: 10000000,
          date: "2026-09-30",
          fundingMonth: "2026-11-15",
        }),
      )
    ).success,
    false,
  );
  const [unlinked] =
    await sql`insert into income(user_id,source,amount,received_at) values(${owner},${prefix + " v12 legacy"},2000000,'2026-09-28') returning id`;
  assert.equal(
    (
      await cash.updateIncome(
        form({
          id: unlinked.id,
          accountId: "",
          label: prefix + " v12 legacy",
          amount: 2000000,
          date: "2026-09-28",
          fundingMonth: "2026-09-01",
        }),
      )
    ).success,
    true,
  );
  assert.equal(await amountAt(v12Bank), 10000000);
  assert.deepEqual(
    await sql`select * from account_movements where account_id=${v12Bank} order by id`,
    ledgerBeforeFunding,
  );
  await cash.deleteIncome(form({ id: unlinked.id }));
  assert.equal(
    (
      await cash.createExpense(
        form({
          accountId: v12Bank,
          label: prefix + " v12 expense",
          amount: 500000,
          date: "2026-10-10",
        }),
      )
    ).success,
    true,
  );
  await bills.createBill(
    form({
      name: prefix + " v12 internet",
      amount: 350000,
      category: "utilities",
      dueDay: 15,
    }),
  );
  const v12Bill = (
    await sql`select id from bills where name=${prefix + " v12 internet"}`
  )[0].id;
  const payBill = form({ id: v12Bill, accountId: v12Bank, date: "2026-10-10" });
  assert.equal((await bills.markBillPaid(payBill)).success, true);
  assert.equal((await bills.markBillPaid(payBill)).success, true);
  await bills.createDebt(
    form({
      name: prefix + " v12 debt",
      lender: "QA",
      originalAmount: 2000000,
      remainingAmount: 2000000,
      installmentAmount: 1000000,
      dueDay: 15,
    }),
  );
  const v12Debt = (
    await sql`select id from debts where name=${prefix + " v12 debt"}`
  )[0].id;
  assert.equal(
    (
      await bills.recordDebtPayment(
        form({
          id: v12Debt,
          accountId: v12Bank,
          amount: 1000000,
          date: "2026-10-10",
        }),
      )
    ).success,
    true,
  );
  const actuals = await getMonthlyReport(october);
  assert.equal(actuals.spending - octBefore.spending, 850000);
  assert.equal(actuals.cashOutflow - octBefore.cashOutflow, 1850000);
  assert.equal(actuals.net - octBefore.net, -1850000);
  assert.equal(actuals.debtPaid - octBefore.debtPaid, 1000000);
  assert.equal(await amountAt(v12Bank), 8150000);
  await accounts.createAccount(
    form({ name: prefix + " v12 wallet", type: "e_wallet", balance: 0 }),
  );
  const v12Wallet = (
    await sql`select id from finance_accounts where name=${prefix + " v12 wallet"}`
  )[0].id;
  await cash.createTransfer(
    form({
      fromAccountId: v12Bank,
      toAccountId: v12Wallet,
      amount: 500000,
      date: "2026-10-10",
    }),
  );
  await accounts.updateAccountBalance(form({ id: v12Bank, balance: 7625000 }));
  const excluded = await getMonthlyReport(october);
  for (const key of ["income", "spending", "cashOutflow", "net"])
    assert.equal(excluded[key], actuals[key]);
  assert.equal(
    (await getDashboardData()).surplus,
    (await getMonthlyReport()).net,
  );
  await bills.deleteBill(form({ id: v12Bill }));
  await bills.deleteDebt(form({ id: v12Debt }));
  for (const id of [v12Bank, v12Wallet]) {
    await sql`delete from income where account_id=${id}`;
    await sql`delete from expenses where account_id=${id}`;
    await sql`delete from account_movements where account_id=${id}`;
    await sql`delete from finance_accounts where id=${id}`;
  }
  console.log(
    "PASS v1.2: bill spending once, debt outflow not spending, actual-date reports vs independent funding, funding-only edits/retries without movements, legacy override, transfer/adjustment exclusion, Overview agreement.",
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
